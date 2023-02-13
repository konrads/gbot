import { Order, Price } from "./types";

export class State {
  private readonly prices: Map<string, Price> = new Map();
  private readonly positions: Map<string, number> = new Map();
  private readonly assetz: string[];
  private readonly ordersByClientOrderId: Map<number, Order> = new Map();
  private readonly tsOrders: [number, number][] = [];

  constructor(assets: string[]) {
    this.assetz = assets;
  }

  get assets(): string[] {
    return this.assetz;
  }

  get pnl(): number {
    return Array.from(this.positions.entries())
      .map(([asset, size]) => size * (this.prices.get(asset)?.price ?? 0))
      .reduce((x, y) => x + y, 0);
  }

  setPrice(asset: string, price: number) {
    this.prices.set(asset, { price, ts: new Date() });
  }

  getPrice(asset: string): Price {
    return this.prices.get(asset);
  }

  setPosition(asset: string, size: number) {
    this.positions.set(asset, size);
  }

  getPosition(asset: string): number {
    return this.positions.get(asset);
  }

  setOrder(order: Order) {
    if ((order.status ?? "issued") == "issued") {
      this.tsOrders.push([Date.now(), order.clientOrderId]);
    }
    this.ordersByClientOrderId.set(order.clientOrderId, order);
  }

  get orders(): [number, Order][] {
    return this.tsOrders.map(([ts, clientOrderId]) => [
      ts,
      this.ordersByClientOrderId.get(clientOrderId),
    ]);
  }
}
