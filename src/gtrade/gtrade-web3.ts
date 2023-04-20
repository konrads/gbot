import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { ChainSpec, Trade } from ".";
import { CouldNotCloseTrade, Dir, MarketOrderInitiated, OpenLimitPlaced, PriceReceived } from "../types";
import { range, translateError } from "../utils";
import { ERC20_ABI, STORAGE_ABI, TRADING_ABI, PRICE_AGGREGATOR_ABI, AGGREGATOR_PROXY_ABI } from "./abi";
import { log } from "../log";

export class GTrade {
  private readonly referrer: string;
  private readonly web3RR: Web3RoundRobin;

  constructor(privKey: string, chainSpec: ChainSpec, referrer: string = "0x0000000000000000000000000000000000000000") {
    this.referrer = referrer;
    this.web3RR = new Web3RoundRobin(privKey, chainSpec);
  }

  async init() {
    await this.web3RR.init();
  }

  async getBalance(): Promise<number> {
    const res = Number(await this.web3RR.execute(async (ctx) => await ctx.web3.eth.getBalance(ctx.wallet.address))) / 10 ** 18;
    return res;
  }

  async getDaiBalance(): Promise<number> {
    const res = Number(await this.web3RR.execute(async (ctx) => await ctx.daiContract.methods.balanceOf(ctx.wallet.address).call())) / 10 ** 18;
    return res;
  }

  // FIXME: solidify return type
  async getAllowance(): Promise<BigInt> {
    const res = await this.web3RR.execute(
      async (ctx) => await ctx.daiContract.methods.allowance(ctx.wallet.address, this.web3RR.chainSpec.storageAddress).call()
    );
    return res;
  }

  async approveAllowance(): Promise<any> {
    const res = await this.web3RR.execute(
      async (ctx) => await ctx.daiContract.methods.approve(this.web3RR.chainSpec.storageAddress, "1000000000000000000000000000000")
    );
    return res;
  }

  async getOpenTradeCount(pair: string, trader?: string): Promise<number> {
    trader = trader ?? (await this.web3RR.execute(async (ctx) => await ctx.wallet.address));
    const pairIndex = this.web3RR.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = Number(await this.web3RR.execute(async (ctx) => await ctx.storageContract.methods.openTradesCount(trader, pairIndex).call()));
    return res;
  }

  async getOpenTradeCounts(trader?: string): Promise<Map<string, number>> {
    trader = trader ?? (await this.web3RR.execute(async (ctx) => await ctx.wallet.address));
    const cnts = await Promise.all(
      this.web3RR.chainSpec.pairs.map(async (x): Promise<[string, number]> => {
        const cnt = Number(await this.web3RR.execute(async (ctx) => await ctx.storageContract.methods.openTradesCount(trader, x.index).call()));
        return [x.pair, cnt];
      })
    );
    return new Map(cnts);
  }

  async getOpenTrades(pair: string, trader?: string): Promise<Trade[]> {
    trader = trader ?? (await this.web3RR.execute(async (ctx) => await ctx.wallet.address));
    const pairIndex = this.web3RR.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = await Promise.all(
      [0, 1, 2].map(async (i) => await this.web3RR.execute(async (ctx) => await ctx.storageContract.methods.openTrades(trader, pairIndex, i).call()))
    );
    const asTrades = res
      .filter((x) => x.trader != "0x0000000000000000000000000000000000000000")
      .map((x) => {
        return {
          trader: x.trader,
          pair,
          index: Number(x.index),
          initialPosToken: Number(x.initialPosToken) / 10 ** 18,
          positionSizeDai: Number(x.positionSizeDai) / 10 ** 18,
          openPrice: Number(x.openPrice) / 10 ** 10,
          buy: x.buy,
          leverage: Number(x.leverage),
          tp: Number(x.tp) / 10 ** 10, // FIXME: revisit, seems wrong
          sl: Number(x.sl) / 10 ** 10, // FIXME: revisit, seems wrong
        };
      });
    return asTrades;
  }

  // Not sure the purpose...
  async getOpenTradesInfo(pair: string, trader?: string, cnt?: number): Promise<any[]> {
    trader = trader ?? (await this.web3RR.execute(async (ctx) => await ctx.wallet.address));
    cnt = cnt ?? (await this.getOpenTradeCount(pair, trader));
    const pairIndex = this.web3RR.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = await Promise.all(
      range(cnt).map(async (i) => await this.web3RR.execute(async (ctx) => await ctx.storageContract.methods.openTradesInfo(trader, pairIndex, i).call()))
    );
    const asInfos = res
      .filter((x) => x.trader != "0x0000000000000000000000000000000000000000")
      .map((x) => {
        return {
          tokenId: Number(x.tokenId),
          tokenPriceDai: Number(x.tokenPriceDai) / 10 ** 10,
          openInterestDai: Number(x.openInterestDai) / 10 ** 18,
          tpLastUpdated: Number(x.tpLastUpdated) / 10 ** 10,
          slLastUpdated: Number(x.slLastUpdated) / 10 ** 10,
          beingMarketClosed: Number(x.beingMarketClosed) / 10 ** 10,
        };
      });
    return asInfos;
  }

  async getOraclePrice(pair: string): Promise<number> {
    const pairInfo = this.web3RR.chainSpec.pairs.find((x) => x.pair.toLowerCase() == pair.toLowerCase());
    if (!pairInfo) throw new Error(`Undefined pair `);
    const proxyContract = await this.web3RR.execute(
      async (ctx) => new ctx.web3.eth.Contract(AGGREGATOR_PROXY_ABI as any, pairInfo.aggregatorProxyAddress, { from: ctx.wallet.address })
    );
    const decimals = pairInfo.decimals ?? Number(await proxyContract.methods.decimals().call());
    pairInfo.decimals = decimals;
    const resp = (await proxyContract.methods.latestAnswer().call()) / 10 ** decimals;
    return resp;
  }

  async issueMarketTrade(
    pair: string,
    size: number,
    oraclePrice: number,
    leverage: number,
    dir: Dir,
    tradeIndex: number,
    slippage: number = 0.05,
    takeProfit?: number,
    stopLoss?: number
  ): Promise<any> {
    let price: number;
    switch (dir) {
      case "buy":
        price = oraclePrice * 1.01;
        break;
      case "sell":
        price = oraclePrice / 1.01;
        break;
      default:
        throw new Error(`Invalid dir ${dir}`);
    }
    return await this.issueTrade(pair, size, price, leverage, dir, tradeIndex, slippage, takeProfit, stopLoss);
  }

  async issueTrade(
    pair: string,
    size: number,
    price: number,
    leverage: number,
    dir: Dir,
    tradeIndex: number = 0,
    slippage: number = 0.01,
    takeProfit?: number,
    stopLoss?: number
  ): Promise<any> {
    const pairIndex = this.web3RR.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    let initialPosToken = 0;
    let positionSizeDai = BigInt(Math.round(size * 10 ** 18));
    let openPrice = BigInt(Math.round(price * 10 ** 10));
    let buy = dir == "buy";
    takeProfit = Math.round((takeProfit ?? (dir == "buy" ? price * 5 : 0)) * 10 ** 10);
    stopLoss = Math.round((stopLoss ?? (dir == "buy" ? 0 : price * 5)) * 10 ** 10);
    slippage = Math.round(slippage * 10 ** 12);

    let orderType = 0;
    let spreadReductionId = 0;

    let order = {
      trader: await this.web3RR.execute(async (ctx) => await ctx.wallet.address),
      pairIndex,
      index: tradeIndex,
      initialPosToken,
      positionSizeDai,
      openPrice,
      buy,
      leverage,
      tp: takeProfit,
      sl: stopLoss,
    };

    return await this.web3RR.execute(async (ctx) => {
      const res = await sendTxnWithRetry(
        ctx.tradingContract.methods.openTrade(order, orderType, spreadReductionId, slippage, this.referrer),
        ctx.wallet.address,
        `issueTrade { pair: ${pair}, dir: ${dir}, price: ${price}, size: ${size}, leverage: ${leverage}}}`
      );
      return res.transactionHash;
    });
  }

  // Sequential close of all trades, tried in parallel and was getting TRANSACTION_REPLACED errors
  async closeAllTrades(pair: string) {
    const trades = await this.getOpenTrades(pair);
    for (var t of trades) {
      await this.closeTrade(pair, t.index);
    }
  }

  async closeTrade(pair: string, tradeIndex: number): Promise<any> {
    const pairIndex = this.web3RR.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    return await this.web3RR.execute(async (ctx) => {
      const res = await sendTxnWithRetry(
        ctx.tradingContract.methods.closeTradeMarket(pairIndex, tradeIndex),
        ctx.wallet.address,
        `closeTrade { pair: ${pair}, tradeIndex: ${tradeIndex}}}`
      );
      return res.transactionHash;
    });
  }

  async subscribeMarketOrderInitiated(traderAddresses: string[], callback: (event: MarketOrderInitiated) => Promise<void>) {
    this.web3RR.execute(async (ctx) =>
      ctx.tradingContract.events
        .MarketOrderInitiated({ filter: { trader: traderAddresses } })
        .on("data", async (data) => {
          const event: MarketOrderInitiated = {
            orderId: Number(+data.returnValues.orderId),
            trader: data.returnValues.trader,
            pairIndex: Number(+data.returnValues.pairIndex),
            open: data.returnValues.open,
          };
          await callback(event);
        })
        .on("connected", async (subId) => log.info("WS subscription MarketOrderInitiated connected", subId))
        .on("disconnected", async (subId) => log.warn("WS subscription MarketOrderInitiated disconnected", subId))
        .on("changed", async (event) => log.warn("WS subscription MarketOrderInitiated changed", event))
        .on("error", async (error, receipt) => log.warn("WS subscription MarketOrderInitiated error", error, receipt))
    );
  }

  async subscribeOpenLimitPlaced(traderAddresses: string[], callback: (event: OpenLimitPlaced) => Promise<void>) {
    this.web3RR.execute(async (ctx) =>
      ctx.tradingContract.events
        .OpenLimitPlaced({ filter: { trader: traderAddresses } })
        .on("data", async (data) => {
          const event: OpenLimitPlaced = {
            trader: data.returnValues.trader,
            pairIndex: Number(+data.returnValues.pairIndex),
            index: Number(+data.returnValues.index),
          };
          await callback(event);
        })
        .on("connected", async (subId) => log.info("WS subscription OpenLimitPlaced connected", subId))
        .on("disconnected", async (subId) => log.warn("WS subscription OpenLimitPlaced disconnected", subId))
        .on("changed", async (event) => log.warn("WS subscription OpenLimitPlaced changed", event))
        .on("error", async (error, receipt) => log.warn("WS subscription OpenLimitPlaced error", error, receipt))
    );
  }

  async subscribeCouldNotCloseTrade(traderAddresses: string[], callback: (event: CouldNotCloseTrade) => Promise<void>) {
    this.web3RR.execute(async (ctx) =>
      ctx.tradingContract.events
        .CouldNotCloseTrade({ filter: { trader: traderAddresses } })
        .on("data", async (data) => {
          const event: CouldNotCloseTrade = {
            trader: data.resultValues.trader,
            pairIndex: Number(+data.resultValues.pairIndex),
            index: Number(+data.resultValues.index),
          };
          await callback(event);
        })
        .on("connected", async (subId) => log.info("WS subscription CouldNotCloseTrade connected", subId))
        .on("disconnected", async (subId) => log.warn("WS subscription CouldNotCloseTrade disconnected", subId))
        .on("changed", async (event) => log.warn("WS subscription CouldNotCloseTrade changed", event))
        .on("error", async (error, receipt) => log.warn("WS subscription CouldNotCloseTrade error", error, receipt))
    );
  }

  async subscribeAggregatorEvents(callback: (event: PriceReceived) => Promise<void>) {
    this.web3RR.execute(async (ctx) =>
      ctx.priceAggregatorContract.events
        .PriceReceived()
        .on("data", async (data) => {
          const event: PriceReceived = {
            request: data.resultValues.request,
            orderId: Number(+data.resultValues.orderId),
            node: data.resultValues.node,
            pairIndex: Number(+data.resultValues.pairIndex),
            price: Number(+data.resultValues.price) / 10 ** 10,
            referencePrice: Number(+data.resultValues.referencePrice) / 10 ** 10,
            linkFee: Number(+data.resultValues.linkFee) / 10 ** 10,
          };
          await callback(event);
          await callback(event);
        })
        .on("connected", async (subId) => log.warn("WS subscription PriceReceived connected", subId))
        .on("disconnected", async (subId) => log.warn("WS subscription PriceReceived disconnected", subId))
        .on("changed", async (event) => log.warn("WS subscription PriceReceived changed", event))
        .on("error", async (error, receipt) => log.warn("WS subscription PriceReceived error", error, "receipt", receipt))
    );
  }
}

async function sendTxnWithRetry(txn, address: string, description: string) {
  const gasLimit = await txn.estimateGas({ from: address, value: 0 });
  let error;
  for (var multiplier of [1, 1.3, 1.5, 1.7, 1.9]) {
    try {
      return await txn.send({ gasLimit: Math.round(gasLimit * multiplier) });
    } catch (e) {
      log.warn(`${description} failed with gasLimit ${gasLimit}, multiplier ${multiplier}, error ${translateError(e)}`);
      error = e;
    }
  }
  throw error;
}

// Enables execution of smart contract calls, with round robin rotation or rpc urls, failing on the last 1.
// Should call succeed, rpcUrl index is kept for future reference.
class Web3RoundRobin {
  readonly chainSpec: ChainSpec;
  private readonly privKey: string;
  private contexts: {
    rpcUrl: string;
    web3: Web3;
    wallet: any;
    daiContract: Contract;
    storageContract: Contract;
    tradingContract: Contract;
    priceAggregatorContract: Contract;
  }[];
  private contextInd = 0;
  private initialized = false;

  constructor(privKey: string, chainSpec: ChainSpec) {
    this.privKey = privKey;
    this.chainSpec = chainSpec;
  }

  async init() {
    this.contexts = await Promise.all(
      this.chainSpec.rpcUrls.map(async (rpcUrl) => {
        const web3 = new Web3(rpcUrl);
        const wallet = web3.eth.accounts.wallet.add(this.privKey);
        const daiContract = new web3.eth.Contract(ERC20_ABI as any, this.chainSpec.daiAddress, { from: wallet.address });
        const storageContract = new web3.eth.Contract(STORAGE_ABI as any, this.chainSpec.storageAddress, { from: wallet.address });
        const tradingAddress = await storageContract.methods.trading().call();
        const tradingContract = new web3.eth.Contract(TRADING_ABI as any, tradingAddress, { from: wallet.address });
        const priceAggregatorAddress = await storageContract.methods.priceAggregator().call();
        const priceAggregatorContract = new web3.eth.Contract(PRICE_AGGREGATOR_ABI as any, priceAggregatorAddress, { from: wallet.address });

        return {
          rpcUrl,
          web3,
          wallet,
          daiContract,
          storageContract,
          tradingContract,
          priceAggregatorContract,
        };
      })
    );
    this.initialized = true;
  }

  async execute<T>(
    fn: (context: {
      wallet: any;
      web3: Web3;
      daiContract: Contract;
      storageContract: Contract;
      tradingContract: Contract;
      priceAggregatorContract: Contract;
    }) => Promise<T>
  ): Promise<T> {
    if (!this.initialized) throw new Error(`Web3RoundRobin uninitialized`);
    for (var i = 0; i < this.contexts.length; i++) {
      const context = this.contexts[this.contextInd];
      try {
        return await fn(context);
      } catch (e) {
        const retryErrors = [`Transaction has been reverted by the EVM`, `CONNECTION ERROR: Couldn't connect to node on WS`, "connection not open on send()"];
        const errorStr = `${e}`;
        const canRetry = retryErrors.find((x) => errorStr.includes(x)) != undefined;
        if (canRetry && i < this.contexts.length - 1) {
          log.warn(`Failed web3 call on url ${context.rpcUrl}, retrying...\n${e}`);
          this.contextInd = (this.contextInd + 1) % this.contexts.length;
        } else throw e;
      }
    }
  }
}
