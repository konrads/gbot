import { Price } from "./types";

export class State {
  private prices: Map<string, Price> = new Map();
  private positions: Map<string, number> = new Map();
  private assetz: string[];

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
}
