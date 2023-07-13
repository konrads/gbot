import { ethers } from "ethers";
import { hexZeroPad } from "ethers/lib/utils";
import { ChainSpec, Trade } from ".";
import { CouldNotCloseTrade, Dir, MarketOrderInitiated, PriceReceived } from "../types";
import { range, sleep } from "../utils";
import { ERC20_ABI, STORAGE_ABI, TRADING_ABI, PRICE_AGGREGATOR_ABI, AGGREGATOR_PROXY_ABI } from "./abi";

export class GTrade {
  private readonly referrer: string;
  private readonly chainSpec: ChainSpec;
  private readonly signer: ethers.Wallet;
  private readonly daiContract: ethers.Contract;
  private readonly storageContract: ethers.Contract;
  private readonly provider: ethers.providers.Provider;
  private _tradingContract: ethers.Contract;
  private _priceAggregatorContract: ethers.Contract;

  constructor(privKey: string, chainSpec: ChainSpec, referrer: string = "0x0000000000000000000000000000000000000000") {
    this.chainSpec = chainSpec;
    this.referrer = referrer;
    this.provider = new ethers.providers.WebSocketProvider(chainSpec.rpcUrls[0]); // FIXME: deprecated, only using the first for compilation purposes
    this.signer = new ethers.Wallet(privKey, this.provider);
    this.daiContract = new ethers.Contract(chainSpec.daiAddress, ERC20_ABI, this.signer);
    // this.daiContract2 = new Contract(ERC20_ABI, chainSpec.daiAddress);
    this.storageContract = new ethers.Contract(chainSpec.storageAddress, STORAGE_ABI, this.signer);
  }

  async getTradingContractAddress(): Promise<string> {
    return await this.storageContract.trading();
  }

  private async getTradingContract(): Promise<ethers.Contract> {
    if (!this._tradingContract) {
      const tradingAddress = await this.storageContract.trading();
      this._tradingContract = new ethers.Contract(tradingAddress, TRADING_ABI, this.signer);
    }
    return this._tradingContract;
  }

  private async getPriceAggregatorContract(): Promise<ethers.Contract> {
    if (!this._priceAggregatorContract) {
      const priceAggregatorAddress = await this.storageContract.priceAggregator();
      this._priceAggregatorContract = new ethers.Contract(priceAggregatorAddress, PRICE_AGGREGATOR_ABI, this.signer);
    }
    return this._priceAggregatorContract;
  }

  async getBalance(): Promise<number> {
    const res = Number(await this.provider.getBalance(this.signer.address)) / 10 ** 18;
    return res;
  }

  async getDaiBalance(): Promise<number> {
    const res = Number(await this.daiContract.balanceOf(this.signer.address)) / 10 ** 18;
    return res;
  }

  // FIXME: solidify return type
  async getAllowance(): Promise<BigInt> {
    const res = await this.daiContract.allowance(this.signer.address, this.chainSpec.storageAddress);
    return res;
  }

  async approveAllowance(): Promise<any> {
    const res = await this.daiContract.approve(this.chainSpec.storageAddress, "1000000000000000000000000000000");
    return res;
  }

  async getOpenTradeCount(pair: string, trader?: string): Promise<number> {
    trader = trader ?? this.signer.address;
    const pairIndex = this.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = Number(await this.storageContract.openTradesCount(trader, pairIndex));
    return res;
  }

  async getOpenTradeCounts(trader?: string): Promise<Map<string, number>> {
    trader = trader ?? this.signer.address;
    const cnts = await Promise.all(
      this.chainSpec.pairs.map(async (x): Promise<[string, number]> => {
        const cnt = Number(await this.storageContract.openTradesCount(trader, x.index));
        return [x.pair, cnt];
      })
    );
    return new Map(cnts);
  }

  async getOpenTrades(pair: string, trader?: string, cnt?: number): Promise<Trade[]> {
    trader = trader ?? this.signer.address;
    cnt = cnt ?? (await this.getOpenTradeCount(pair, trader));
    const pairIndex = this.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = await Promise.all(range(cnt).map(async (i) => await this.storageContract.openTrades(trader, pairIndex, i)));
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
    trader = trader ?? this.signer.address;
    cnt = cnt ?? (await this.getOpenTradeCount(pair, trader));
    const pairIndex = this.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = await Promise.all(range(cnt).map(async (i) => await this.storageContract.openTradesInfo(trader, pairIndex, i)));
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
    const proxyContract = new ethers.Contract(pairInfo.aggregatorProxyAddress, AGGREGATOR_PROXY_ABI, this.signer);
    const decimals = pairInfo.decimals ?? Number(await proxyContract.decimals());
    pairInfo.decimals = decimals;
    const resp = (await proxyContract.latestAnswer()) / 10 ** decimals;
    return resp;
  }

  async issueMarketTrade(
    pair: string,
    size: number,
    leverage: number,
    dir: Dir,
    tradeIndex: number = 0,
    slippage: number = 0.01,
    takeProfit?: number,
    stopLoss?: number
  ): Promise<[number, ethers.providers.TransactionReceipt]> {
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
    return [oraclePrice, await this.issueTrade(pair, size, price, leverage, dir, tradeIndex, slippage, takeProfit, stopLoss)];
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
  ): Promise<ethers.providers.TransactionReceipt> {
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
      trader: this.signer.address,
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
    const res = await tradingContract.openTrade(order, orderType, spreadReductionId, slippage, this.referrer);
    const receipt = await res.wait();
    return receipt;
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

  async closeTrade(pair: string, tradeIndex: number = 0): Promise<[number, ethers.providers.TransactionReceipt]> {
    const pairIndex = this.chainSpec.pairs.find((x) => x.pair == pair).index;
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = await (await this.getTradingContract()).closeTradeMarket(pairIndex, tradeIndex);
    const receipt = await res.wait();
    const oraclePrice = await this.getOraclePrice(pair);
    return [oraclePrice, receipt];
  }

  async subscribeMarketOrderInitiated(traderAddresses: string[], callback: (event: MarketOrderInitiated) => Promise<void>) {
    const tradingContract = await this.getTradingContract();
    const filter = {
      topics: [ethers.utils.id("MarketOrderInitiated(uint256,address,uint256,bool)"), null, traderAddresses.map((addr) => hexZeroPad(addr, 32))],
    };
    tradingContract.on(filter, async (orderId: BigInt, trader: string, pairIndex: BigInt, open: boolean) => {
      const event: MarketOrderInitiated = {
        orderId: Number(orderId),
        trader,
        pairIndex: Number(pairIndex),
        open,
      };
      await callback(event);
    });
  }

  async subscribeCouldNotCloseTrade(traderAddresses: string[], callback: (event: CouldNotCloseTrade) => Promise<void>) {
    const tradingContract = await this.getTradingContract();
    const filter = {
      topics: [ethers.utils.id("CouldNotCloseTrade(address,uint256,uint256)"), traderAddresses.map((addr) => hexZeroPad(addr, 32))],
    };
    tradingContract.on(filter, async (trader: string, pairIndex: BigInt, index: BigInt) => {
      const event: CouldNotCloseTrade = {
        trader,
        pairIndex: Number(pairIndex),
        index: Number(index),
      };
      await callback(event);
    });
  }

  async subscribeAggregatorEvents(callback: (event: PriceReceived) => Promise<void>) {
    const aggContract = await this.getPriceAggregatorContract();
    await aggContract.on(
      "PriceReceived",
      async (request: string, orderId: BigInt, node: string, pairIndex: BigInt, price: BigInt, referencePrice: BigInt, linkFee: BigInt) => {
        const event: PriceReceived = {
          request,
          orderId: Number(orderId),
          node,
          pairIndex: Number(pairIndex),
          price: Number(price) / 10 ** 10,
          referencePrice: Number(referencePrice) / 10 ** 10,
          linkFee: Number(linkFee) / 10 ** 10,
        };
        await callback(event);
      }
    );
  }
}
