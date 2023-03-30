import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { ChainSpec, Trade } from ".";
import { CouldNotCloseTrade, Dir, MarketOrderInitiated, PriceReceived } from "../types";
import { range, sleep } from "../utils";
import { ERC20_ABI, STORAGE_ABI, TRADING_ABI, PRICE_AGGREGATOR_ABI, AGGREGATOR_PROXY_ABI } from "./abi";
import { log } from "../log";

export class GTrade {
  private readonly referrer: string;
  private readonly chainSpec: ChainSpec;
  private readonly web3: Web3;
  private readonly wallet; // FIXME: no type
  private readonly daiContract: Contract;
  private readonly storageContract: Contract;
  private _tradingContract: Contract;
  private _priceAggregatorContract: Contract;

  constructor(privKey: string, chainSpec: ChainSpec, referrer: string = "0x0000000000000000000000000000000000000000") {
    this.chainSpec = chainSpec;
    this.referrer = referrer;
    this.web3 = new Web3(chainSpec.rpcUrl);
    this.wallet = this.web3.eth.accounts.wallet.add(privKey);
    this.daiContract = new this.web3.eth.Contract(ERC20_ABI as any, chainSpec.daiAddress, { from: this.wallet.address });
    this.storageContract = new this.web3.eth.Contract(STORAGE_ABI as any, chainSpec.storageAddress, { from: this.wallet.address });
  }

  async getTradingContractAddress(): Promise<string> {
    return await this.storageContract.methods.trading().call();
  }

  private async getTradingContract(): Promise<Contract> {
    if (!this._tradingContract) {
      const tradingAddress = await this.storageContract.methods.trading().call();
      this._tradingContract = new this.web3.eth.Contract(TRADING_ABI as any, tradingAddress, { from: this.wallet.address });
    }
    return this._tradingContract;
  }

  private async getPriceAggregatorContract(): Promise<Contract> {
    if (!this._priceAggregatorContract) {
      const priceAggregatorAddress = await this.storageContract.methods().priceAggregator().call();
      this._priceAggregatorContract = new this.web3.eth.Contract(PRICE_AGGREGATOR_ABI as any, priceAggregatorAddress, { from: this.wallet.address });
    }
    return this._priceAggregatorContract;
  }

  async getBalance(): Promise<number> {
    const res = Number(await this.web3.eth.getBalance(this.wallet.address)) / 10 ** 18;
    return res;
  }

  async getDaiBalance(): Promise<number> {
    const res = Number(await this.daiContract.methods.balanceOf(this.wallet.address).call()) / 10 ** 18;
    return res;
  }

  // FIXME: solidify return type
  async getAllowance(): Promise<BigInt> {
    const res = await this.daiContract.methods.allowance(this.wallet.address, this.chainSpec.storageAddress).call();
    return res;
  }

  async approveAllowance(): Promise<any> {
    const res = await this.daiContract.methods.approve(this.chainSpec.storageAddress, "1000000000000000000000000000000");
    return res;
  }

  async getOpenTradeCount(pair: string, trader?: string): Promise<number> {
    trader = trader ?? this.wallet.address;
    const pairIndex = this.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = Number(await this.storageContract.methods.openTradesCount(trader, pairIndex).call());
    return res;
  }

  async getOpenTradeCounts(trader?: string): Promise<Map<string, number>> {
    trader = trader ?? this.wallet.address;
    const cnts = await Promise.all(
      this.chainSpec.pairs.map(async (x): Promise<[string, number]> => {
        const cnt = Number(await this.storageContract.methods.openTradesCount(trader, x.index).call());
        return [x.pair, cnt];
      })
    );
    return new Map(cnts);
  }

  async getOpenTrades(pair: string, trader?: string, cnt?: number): Promise<Trade[]> {
    trader = trader ?? this.wallet.address;
    cnt = cnt ?? (await this.getOpenTradeCount(pair, trader));
    const pairIndex = this.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = await Promise.all(range(cnt).map(async (i) => await this.storageContract.methods.openTrades(trader, pairIndex, i).call()));
    const asTrades = res.map((x) => {
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
    trader = trader ?? this.wallet.address;
    cnt = cnt ?? (await this.getOpenTradeCount(pair, trader));
    const pairIndex = this.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = await Promise.all(range(cnt).map(async (i) => await this.storageContract.methods.openTradesInfo(trader, pairIndex, i).call()));
    const asInfos = res.map((x) => {
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
    const pairInfo = this.chainSpec.pairs.find((x) => x.pair.toLowerCase() == pair.toLowerCase());
    if (!pairInfo) throw new Error(`Undefined pair `);
    const proxyContract = new this.web3.eth.Contract(AGGREGATOR_PROXY_ABI as any, pairInfo.aggregatorProxyAddress, { from: this.wallet.address });
    const decimals = pairInfo.decimals ?? Number(await proxyContract.methods.decimals().call());
    pairInfo.decimals = decimals;
    const resp = (await proxyContract.methods.latestAnswer().call()) / 10 ** decimals;
    return resp;
  }

  async issueMarketTrade(
    pair: string,
    size: number,
    leverage: number,
    dir: Dir,
    takeProfit?: number,
    stopLoss?: number,
    tradeIndex: number = 0,
    slippage: number = 0.01
  ): Promise<[number, any]> {
    const oraclePrice = await this.getOraclePrice(pair);
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
    return [oraclePrice, await this.issueTrade(pair, size, price, leverage, dir, takeProfit, stopLoss, tradeIndex, slippage)];
  }

  async issueTrade(
    pair: string,
    size: number,
    price: number,
    leverage: number,
    dir: Dir,
    takeProfit?: number,
    stopLoss?: number,
    tradeIndex: number = 0,
    slippage: number = 0.01
  ): Promise<any> {
    const pairIndex = this.chainSpec.pairs.find((x) => x.pair == pair).index;
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
      trader: this.wallet.address,
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

    const tradingContract = await this.getTradingContract();
    let gasLimit = await tradingContract.methods.openTrade(order, orderType, spreadReductionId, slippage, this.referrer).estimateGas({
      from: this.wallet.address,
      value: 0,
    });
    const res = await tradingContract.methods.openTrade(order, orderType, spreadReductionId, slippage, this.referrer).send({ gasLimit: gasLimit });
    return res.transactionHash;
  }

  // Sequential close of all trades, tried in parallel and was getting TRANSACTION_REPLACED errors
  async closeAllTrades(): Promise<Map<string, number>> {
    const counts = await this.getOpenTradeCounts();
    const nonZeroCounts = [...counts.entries()].filter(([_, v]) => v != 0);
    for (var [pair, count] of nonZeroCounts) {
      for (var i = count - 1; i >= 0; i--) {
        await this.closeTrade(pair, i);
        await sleep(1000);
      }
    }
    return new Map(nonZeroCounts);
  }

  async closeTrade(pair: string, tradeIndex: number = 0): Promise<[number, any]> {
    const pairIndex = this.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const tradingContract = await this.getTradingContract();
    const gasLimit = await tradingContract.methods.closeTradeMarket(pairIndex, tradeIndex).estimateGas({
      from: this.wallet.address,
      value: 0,
    });
    const res = await tradingContract.methods.closeTradeMarket(pairIndex, tradeIndex).send({ gasLimit: gasLimit });
    const oraclePrice = await this.getOraclePrice(pair);
    return [oraclePrice, res.transactionHash];
  }

  async subscribeMarketOrderInitiated(traderAddresses: string[], callback: (event: MarketOrderInitiated) => Promise<void>) {
    const tradingContract = await this.getTradingContract();
    tradingContract.events
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
      .on("connected", async (subId) => log.warn("WS subscription MarketOrderInitiated connected", subId))
      .on("disconnected", async (subId) => log.warn("WS subscription MarketOrderInitiated disconnected", subId))
      .on("changed", async (event) => log.warn("WS subscription MarketOrderInitiated changed", event))
      .on("error", async (error, receipt) => log.warn("WS subscription MarketOrderInitiated error", error, receipt));
  }

  async subscribeCouldNotCloseTrade(traderAddresses: string[], callback: (event: CouldNotCloseTrade) => Promise<void>) {
    const tradingContract = await this.getTradingContract();
    tradingContract.events
      .CouldNotCloseTrade({ filter: { trader: traderAddresses } })
      .on("data", async (data) => {
        const event: CouldNotCloseTrade = {
          trader: data.resultValues.trader,
          pairIndex: Number(+data.resultValues.pairIndex),
          index: Number(+data.resultValues.index),
        };
        await callback(event);
      })
      .on("connected", async (subId) => log.warn("WS subscription CouldNotCloseTrade connected", subId))
      .on("disconnected", async (subId) => log.warn("WS subscription CouldNotCloseTrade disconnected", subId))
      .on("changed", async (event) => log.warn("WS subscription CouldNotCloseTrade changed", event))
      .on("error", async (error, receipt) => log.warn("WS subscription CouldNotCloseTrade error", error, receipt));
  }

  async subscribeAggregatorEvents(callback: (event: PriceReceived) => Promise<void>) {
    const aggContract = await this.getPriceAggregatorContract();
    aggContract.events
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
      .on("error", async (error, receipt) => log.warn("WS subscription PriceReceived error", error, "receipt", receipt));
  }
}
