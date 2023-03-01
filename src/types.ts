export interface Price {
  price: number;
  ts: Date;
}

export type Dir = "buy" | "sell";

export interface Order {
  asset: string;
  dir: Dir;
  price: number;
  amount: number;
  owner: string;
  clientOrderId?: number;
  orderId?: number; // populated once back from exchange
  status?: Status;
}

export type EventType = "orderPlaced" | "orderCancelled" | "orderFilled" | "positionUpdate";

export type Status = "issued" | "placed" | "cancelled" | "filled";
