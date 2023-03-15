import { ethers } from "ethers";
import { hexZeroPad } from "ethers/lib/utils";
import { CouldNotCloseTrade, Dir, MarketOrderInitiated } from "../types";
import { range } from "../utils";
import { ERC20_ABI, STORAGE_ABI, TRADING_ABI } from "./abi";

export interface ChainSpec {
  daiAddress: string;
  storageAddress: string;
  rpcUrl: string;
}

export const POLYGON_SPEC: ChainSpec = {
  daiAddress: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  storageAddress: "0xaee4d11a16B2bc65EDD6416Fb626EB404a6D65BD",
  rpcUrl: "wss://polygon.llamarpc.com",
};

export const ARBITRUM_SPEC: ChainSpec = {
  daiAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  storageAddress: "0xcFa6ebD475d89dB04cAd5A756fff1cb2BC5bE33c",
  rpcUrl: "wss://arb-mainnet.g.alchemy.com/v2/BnencMGjoPsmbRIjrDZvh4zLTmlZyDtG",
};

export const MUMBAI_SPEC: ChainSpec = {
  daiAddress: "0x04b2a6e51272c82932ecab31a5ab5ac32ae168c3",
  storageAddress: "0x4d2df485c608aa55a23d8d98dd2b4fa24ba0f2cf",
  rpcUrl: "wss://polygon-mumbai.g.alchemy.com/v2/US6ybgcQC9-FpHhr0TOiBN35NKYH18r5",
};

export enum GtradeOrderType {
  Market = 0,
}

const GTRADE_PAIRS = [
  "btc",
  "eth",
  "link",
  "doge",
  "matic",
  "ada",
  "sushi",
  "aave",
  "algo",
  "bat",
  "comp",
  "dot",
  "eos",
  "ltc",
  "mana",
  "omg",
  "snx",
  "uni",
  "xlm",
  "xrp",
  "zec",
  "audusd",
  "eurchf",
  "eurgbp",
  "eurjpy",
  "eurusd",
  "gbpusd",
  "nzdusd",
  "usdcad",
  "usdchf",
  "usdjpy",
  "luna",
  "yfi",
  "sol",
  "xtz",
  "bch",
  "bnt",
  "crv",
  "dash",
  "etc",
  "icp",
  "mkr",
  "neo",
  "theta",
  "trx",
  "zrx",
];

export class GTrade {
  private readonly referrer: string;
  private readonly chainSpec: ChainSpec;
  private readonly signer: ethers.Wallet;
  private readonly daiContract: ethers.Contract;
  private readonly storageContract: ethers.Contract;
  private readonly provider: ethers.providers.Provider;
  private _tradingAddress: string;
  private _tradingContract: ethers.Contract;

  constructor(privKey: string, chainSpec: ChainSpec, referrer: string = "0x0000000000000000000000000000000000000000") {
    this.chainSpec = chainSpec;
    this.referrer = referrer;
    this.provider = new ethers.providers.WebSocketProvider(chainSpec.rpcUrl);
    this.signer = new ethers.Wallet(privKey, this.provider);
    this.daiContract = new ethers.Contract(chainSpec.daiAddress, ERC20_ABI, this.signer);
    this.storageContract = new ethers.Contract(chainSpec.storageAddress, STORAGE_ABI, this.signer);
  }

  private async getTradingContract(): Promise<ethers.Contract> {
    if (!this._tradingContract) {
      const tradingAddress = await this.storageContract.trading();
      this._tradingContract = new ethers.Contract(tradingAddress, TRADING_ABI, this.signer);
    }
    return this._tradingContract;
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

  async getOpenTradeCount(pair: string): Promise<number> {
    const pairIndex = GTRADE_PAIRS.indexOf(pair);
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = Number(await this.storageContract.openTradesCount(this.signer.address, pairIndex));
    return res;
  }

  async getOpenTradeCounts(): Promise<Map<string, number>> {
    const cnts = await Promise.all(
      range(GTRADE_PAIRS.length).map(async (i): Promise<[string, number]> => {
        const cnt = Number(await this.storageContract.openTradesCount(this.signer.address, i));
        return [GTRADE_PAIRS[i], cnt];
      })
    );
    return new Map(cnts);
  }

  async getOpenTrades(pair: string, cnt?: number): Promise<any[]> {
    cnt = cnt ?? (await this.getOpenTradeCount(pair));
    const pairIndex = GTRADE_PAIRS.indexOf(pair);
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = await Promise.all(range(cnt).map(async (i) => await this.storageContract.openTrades(this.signer.address, pairIndex, i)));
    const asTrades = res.map((x) => {
      return {
        owner: x.trader,
        asset: GTRADE_PAIRS[Number(x.pairIndex)],
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
  async getOpenTradesInfo(pair: string, cnt?: number): Promise<any[]> {
    cnt = cnt ?? (await this.getOpenTradeCount(pair));
    const pairIndex = GTRADE_PAIRS.indexOf(pair);
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = await Promise.all(range(cnt).map(async (i) => await this.storageContract.openTradesInfo(this.signer.address, pairIndex, i)));
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

  async issueTrade(
    pair: string,
    size: number,
    price: number,
    leverage: number,
    dir: Dir,
    /* clientTradeId: number, */
    takeProfit?: number,
    stopLoss?: number,
    tradeIndex: number = 0,
    slippage: number = 0.01
  ): Promise<ethers.providers.TransactionReceipt> {
    // FIXME: inject clientTradeId!
    const pairIndex = GTRADE_PAIRS.indexOf(pair);
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    let initialPosToken = 0;
    let positionSizeDai = BigInt(size * 10 ** 18);
    let openPrice = price * 10 ** 10;
    let buy = dir == "buy";
    takeProfit = (takeProfit ?? dir == "buy" ? price * 5 : 0) * 10 ** 10;
    stopLoss = (stopLoss ?? dir == "buy" ? 0 : price * 5) * 10 ** 10;
    slippage = slippage * 10 ** 12;

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

  async closeTrade(pair: string, tradeIndex: number): Promise<ethers.providers.TransactionReceipt> {
    const pairIndex = GTRADE_PAIRS.indexOf(pair);
    if (pairIndex < 0) throw new Error(`Invalid pair ${pair}`);
    const res = await (await this.getTradingContract()).closeTradeMarket(pairIndex, tradeIndex);
    const receipt = await res.wait();
    return receipt;
  }

  async subscribe(traderAddresses: string[], callback: (event: MarketOrderInitiated | CouldNotCloseTrade) => Promise<void>) {
    const tradingContract = await this.getTradingContract();
    const filter1 = {
      topics: [ethers.utils.id("MarketOrderInitiated(uint256,address,uint256,bool)"), null, traderAddresses.map((addr) => hexZeroPad(addr, 32))],
    };
    tradingContract.on(filter1, async (orderId: BigInt, trader: string, pairIndex: BigInt, open: boolean) => {
      const event: MarketOrderInitiated = {
        orderId: Number(orderId),
        trader,
        pairIndex: Number(pairIndex),
        open,
      };
      await callback(event);
    });
    const filter2 = {
      topics: [ethers.utils.id("CouldNotCloseTrade(address,uint256,uint256)"), traderAddresses.map((addr) => hexZeroPad(addr, 32))],
    };
    tradingContract.on(filter2, async (trader: string, pairIndex: BigInt, index: BigInt) => {
      const event: CouldNotCloseTrade = {
        trader,
        pairIndex: Number(pairIndex),
        index: Number(index),
      };
      await callback(event);
    });
  }

  async shutdown() {
    // TODO: shut down subscriptions
  }
}
