import { Order } from "./types";
import ccxt from "ccxt";
import { Asset } from "./configuration";

export interface ITrader {
  sendOrder(order: Order): Promise<void>;
  subscribeMarkPrices(callback: (string, number) => void);
  shutdown();
}

export class Trader {
  private assets: Asset[];
  private refExchange: ccxt.ExchangePro;
  private isShuttingDown: boolean = false;

  constructor(assets: Asset[], refExchange: string) {
    this.assets = assets;
    this.refExchange = new ccxt.pro[refExchange]();
  }

  async sendOrder(order: Order): Promise<void> {
    throw new Error("Unimplemented!!!");
  }

  subscribeMarkPrices(callback: (string, number) => void) {
    this.assets.forEach(async ({ gainsTicker, refTicker }) => {
      while (!this.isShuttingDown) {
        const orderbook = await this.refExchange.watchOrderBook(refTicker);
        if (orderbook.bids.length > 0 && orderbook.asks.length > 0) {
          const bidPrice = orderbook.bids[0][0];
          const bidSize = orderbook.bids[0][1];
          const askPrice = orderbook.asks[0][0];
          const askSize = orderbook.asks[0][1];
          const fairPrice = (bidPrice * bidSize + askPrice * askSize) / (bidSize + askSize);
          callback(gainsTicker, fairPrice);
        }
      }
    });
  }

  async shutdown() {
    this.isShuttingDown = true;
  }
}
