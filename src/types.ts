import { boolean } from "cmd-ts";

export interface Price {
  price: number;
  ts: Date;
}

export interface Trade {
  asset: Asset;
  dir: Dir;
  openPrice: number;
  amount: number;
  leverage: number;
  owner: Address;
  clientTradeId?: TradeId;
  tradeId?: number; // populated once back from exchange
  status?: Status;
  closePrice?: number;
}

export interface GTrade {
  trader: string;
  pairIndex: number;
  index: number;
  initialPosToken: number;
  positionSizeDai: number;
  openPrice: number;
  buy: boolean;
  leverage: number;
  tp?: number;
  sl?: number;
}

export type EventType = "tradePlaced" | "tradeCancelled" | "tradeFilled" | "tradeClosed";

export type Dir = "buy" | "sell";

export type Status = "placed" | "cancelled" | "filled" | "closed";

export type Address = string;

export type Asset = string;

export type TradeId = number;

export interface MarketOrderInitiated {
  orderId: number;
  trader: string;
  pairIndex: number;
  open: boolean;
}

export interface CouldNotCloseTrade {
  trader: string;
  pairIndex: number;
  index: number;
}
