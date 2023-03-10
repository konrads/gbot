import { Trade, Address, TradeId } from "./types";
import { AssetMapping } from "./configuration";

export interface ITrader {
  createTrade(trade: Trade): Promise<void>;
  cancelTrade(clientTradeId: TradeId): Promise<void>;
  closeTrade(clientTradeId: TradeId): Promise<void>;
  subscribeEvents(callback: (address: Address, data: any) => Promise<void>): Promise<void>;
  shutdown();
}

export class Trader {
  private assets: AssetMapping[];
  private isShuttingDown: boolean = false;

  constructor(assets: AssetMapping[]) {
    this.assets = assets;
  }

  async createTrade(trade: Trade): Promise<void> {
    throw new Error("createTrade unimplemented!!!");
  }

  async cancelTrade(clientTradeId: TradeId): Promise<void> {
    throw new Error("cancelTrade unimplemented!!!");
  }

  async closeTrade(clientTradeId: TradeId): Promise<void> {
    throw new Error("closeTrade unimplemented!!!");
  }

  async subscribeEvents(callback: (address: Address, data: any) => Promise<void>): Promise<void> {
    throw new Error("subscribeEvents unimplemented!!!");
  }

  async shutdown() {
    this.isShuttingDown = true;
  }
}
