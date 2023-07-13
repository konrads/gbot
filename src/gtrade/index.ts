import { Dir, MarketOrderInitiated } from "../types";

export { GTrade } from "./gtrade-web3";
//export { GTrade } from "./gtrade-ethers";

export interface ChainSpec {
  id: string;
  daiAddress: string;
  storageAddress: string;
  rpcUrls: string[];
  pairs: { index: number; pair: string; aggregatorProxyAddress: string; decimals?: number }[];
}

export interface Trade {
  trader: string;
  pair: string;
  index: number;
  initialPosToken: number;
  positionSizeDai: number;
  openPrice: number;
  buy: boolean;
  leverage: number;
  tp: number;
  sl: number;
}

export enum GtradeOrderType {
  Market = 0,
}

interface IGTrade {
  getTradingContractAddress(): Promise<string>;
  getBalance(): Promise<number>;
  getDaiBalance(): Promise<number>;
  getAllowance(): Promise<BigInt>;
  approveAllowance(): Promise<any>;
  getOpenTradeCount(pair: string, trader?: string): Promise<number>;
  getOpenTradeCounts(trader?: string): Promise<Map<string, number>>;
  getOpenTrades(pair: string, trader?: string): Promise<Trade[]>;
  getOpenTradesInfo(pair: string, trader?: string, cnt?: number): Promise<any[]>;
  getOraclePrice(pair: string): Promise<number>;
  issueMarketTrade(
    pair: string,
    size: number,
    oraclePrice: number,
    leverage: number,
    dir: Dir,
    tradeIndex: number,
    slippage: number,
    takeProfit?: number,
    stopLoss?: number
  ): Promise<any>;
  issueTrade(
    pair: string,
    size: number,
    price: number,
    leverage: number,
    dir: Dir,
    tradeIndex: number,
    slippage: number,
    takeProfit?: number,
    stopLoss?: number
  ): Promise<any>;
  closeAllTrades(pair: string): Promise<void>;
  closeTrade(pair: string, tradeIndex: number): Promise<any>;
  subscribeMarketOrderInitiated(traderAddresses: string[], callback: (event: MarketOrderInitiated) => Promise<void>): Promise<void>;
}
