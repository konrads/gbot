// places new orders
// fills and cancels orders existing
// updates positions as per fills

import { MockParams } from "./configuration";
import { log } from "./log";
import { Trader } from "./trader";
import { Address, Dir, Trade, Status, TradeId, Symbol } from "./types";
import { randomVal } from "./utils";

export class MockTrader {
  private readonly trader: Trader;
  private readonly mockExchange: MockExchange;

  constructor(trader: Trader, mockExchange: MockExchange) {
    this.trader = trader;
    this.mockExchange = mockExchange;
  }

  async createTrade(trade: Trade): Promise<void> {
    return await this.mockExchange.createTrade(trade);
  }

  async cancelTrade(clientTradeId: TradeId): Promise<void> {
    return await this.mockExchange.cancelTrade(clientTradeId);
  }

  async closeTrade(clientTradeId: TradeId): Promise<void> {
    return await this.mockExchange.closeTrade(clientTradeId);
  }

  async subscribeEvents(callback: (address: Address, data: any) => Promise<void>): Promise<void> {
    // return await this.mockExchange.subscribeEvents(callback);
  }

  async shutdown() {
    return await this.trader.shutdown();
  }
}

export class MockExchange {
  private monitoredTrader: string;
  private bogusTrader: string;
  private myPubkey: string;
  private symbols: Symbol[];
  private handleEvent: (ownerPubkey: string, data) => Promise<void>;
  private tickCnt: number = 0;
  private expTrade: Trade;

  constructor(myPubkey: string, monitoredTrader: string, mockParams: MockParams, symbols: Symbol[]) {
    this.myPubkey = myPubkey;
    this.monitoredTrader = monitoredTrader;
    this.bogusTrader = mockParams.bogusTrader;
    this.symbols = symbols;
  }

  initialize(handler: (ownerPubkey: string, data) => Promise<void>) {
    this.handleEvent = handler;
    setInterval(() => this.tick(), 1000); // refresh every sec
  }

  createTrade(trade: Trade) {
    this.expTrade = { ...trade, clientTradeId: this.tickCnt, status: "placed", owner: this.myPubkey };
  }

  cancelTrade(tradeId: TradeId) {
    if (tradeId == this.expTrade?.clientTradeId) this.expTrade = { ...this.expTrade, status: "cancelled" };
    else log.warn(`Unexpected tradeId ${tradeId} to cancel, have expTrade ${JSON.stringify(this.expTrade)}`);
  }

  closeTrade(tradeId: TradeId) {
    if (tradeId == this.expTrade?.clientTradeId) this.expTrade = { ...this.expTrade, status: "closed", closePrice: Math.round(Math.random() * 10_000) };
    else log.warn(`Unexpected tradeId ${tradeId} to close, have expTrade ${JSON.stringify(this.expTrade)}`);
  }

  tick() {
    log.info(`mock tick ${this.tickCnt}, expTrade: ${JSON.stringify(this.expTrade)}`);
    let rand = Math.random();
    let template: Trade = {
      symbol: randomVal(this.symbols),
      dir: randomVal(["buy", "sell"]) as Dir,
      owner: randomVal([this.myPubkey, this.monitoredTrader, this.bogusTrader]),
      openPrice: Math.random() * 10_000,
      amount: Math.round(Math.random() * 100),
      leverage: Math.round(Math.random() * 10),
      tradeId: this.tickCnt,
      clientTradeId: this.tickCnt,
      status: randomVal(["placed", "cancelled", "filled", "closed"]) as Status,
    };

    if (rand < 0.4) {
      // issuing my trade as requested by client
      if (this.expTrade) {
        if (this.expTrade?.status == "placed") {
          if (Math.random() < 0.7) {
            this.expTrade.status = "filled";
            log.info(`Progressing my trade to filled!`);
            this.handleEvent(this.myPubkey, this.expTrade);
          } else {
            this.expTrade.status = "cancelled";
            log.info(`Progressing my trade to cancelled!`);
            this.handleEvent(this.myPubkey, this.expTrade);
            this.expTrade = undefined;
          }
        } else if (this.expTrade?.status == "filled") {
          this.expTrade.status = "closed";
          log.info(`Progressing my trade to closed!`);
          this.handleEvent(this.myPubkey, this.expTrade);
          this.expTrade = undefined;
        } else {
          throw new Error(`Unexpected expTrade status: ${JSON.stringify(this.expTrade)}`);
        }
      } else {
        log.info(`Have no expTrade, skipping...`);
      }
    } else if (rand > 0.4 && rand < 0.6) {
      // issuing my trade with unknown ids
      const myTrade = { ...template, owner: this.myPubkey, clientTradeId: 1_234_456 };
      this.handleEvent(this.myPubkey, myTrade);
    } else if (rand > 0.6 && rand < 0.8) {
      // issuing random monitoredTrader event
      const myTrade = { ...template, owner: this.monitoredTrader };
      this.handleEvent(this.monitoredTrader, myTrade);
    } else if (rand > 0.8) {
      const myTrade = { ...template, owner: this.bogusTrader };
      this.handleEvent(this.bogusTrader, myTrade);
    } else {
      throw new Error(`wtf ${rand}???`);
    }
    this.tickCnt += 1;
  }
}
