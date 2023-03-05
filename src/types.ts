export interface Price {
  price: number;
  ts: Date;
}

export interface Trade {
  symbol: Symbol;
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

export type EventType = "tradePlaced" | "tradeCancelled" | "tradeFilled" | "tradeClosed";

export type Dir = "buy" | "sell";

export type Status = "placed" | "cancelled" | "filled" | "closed";

export type Address = string;

export type Symbol = string;

export type TradeId = number;
