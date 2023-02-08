export interface Price {
  price: number;
  ts: Date;
}

export type Dir = "buy" | "sell";

export interface Order {
  asset: string;
  dir: Dir;
  amount: number;
  clientOrderId: number;
  orderId?: number; // populated once back from exchange
}
