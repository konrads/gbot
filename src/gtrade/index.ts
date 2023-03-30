export { GTrade } from "./gtrade-web3";
//export { GTrade } from "./gtrade-ethers";

export interface ChainSpec {
  id: string;
  daiAddress: string;
  storageAddress: string;
  rpcUrl: string;
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
