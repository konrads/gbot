export type Dir = "buy" | "sell";

///// gains events
export interface MarketOrderInitiated {
  orderId: number; // gains: why not index???...
  trader: string;
  pairIndex: number;
  open: boolean;
}

export interface OpenLimitPlaced {
  trader: string;
  pairIndex: number;
  index: number;
}

export interface CouldNotCloseTrade {
  trader: string;
  pairIndex: number;
  index: number;
}

export interface PriceReceived {
  request: string;
  orderId: number;
  node: string;
  pairIndex: number;
  price: number; // Note: this seems to be the actual price
  referencePrice: number;
  linkFee: number;
}

export interface LedgerTrade {
  pair: string;
  dir: Dir;
  size: number;
  leverage: number;
  openPrice: number;
  openTs: Date;
  closePrice?: number;
  closeTs?: Date;
}
