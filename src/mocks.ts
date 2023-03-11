// places new orders
// fills and cancels orders existing
// updates positions as per fills

import { AssetMapping, MockParams } from "./configuration";
import { log } from "./log";
import { State } from "./state";
import { Trader } from "./trader";
import { Address, Dir, Trade, Status, TradeId, Asset } from "./types";
import { randomVal, randomPlusPerc } from "./utils";

const ASSET_PRICE_DEFAULT: Map<Asset, number> = new Map([
  ["BTC", 20_000],
  ["ETH", 1500],
  ["SOL", 15],
  ["APT", 10],
]);

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
  private assetMappings: AssetMapping[];
  private handleEvent: (ownerPubkey: string, data) => Promise<void>;
  private tickCnt: number = 0;
  private clientTrades: Map<TradeId, Trade> = new Map();
  private clientReqs: { clientTradeId: TradeId; action: "new" | "close" | "cancel" }[] = [];

  constructor(myPubkey: string, monitoredTrader: string, mockParams: MockParams, assetMappings: AssetMapping[]) {
    this.myPubkey = myPubkey;
    this.monitoredTrader = monitoredTrader;
    this.bogusTrader = mockParams.bogusTrader;
    this.assetMappings = assetMappings;
  }

  initialize(handler: (ownerPubkey: string, data) => Promise<void>) {
    this.handleEvent = handler;
    setInterval(async () => await this.tick(), 1000); // refresh every sec
  }

  createTrade(trade: Trade) {
    this.clientTrades.set(trade.clientTradeId, { ...trade });
    this.clientReqs.push({ clientTradeId: trade.clientTradeId, action: "new" });
  }

  cancelTrade(clientTradeId: TradeId) {
    this.clientReqs.push({ clientTradeId: clientTradeId, action: "cancel" });
  }

  closeTrade(clientTradeId: TradeId) {
    this.clientReqs.push({ clientTradeId: clientTradeId, action: "close" });
  }

  async tick() {
    const rand = this.random();
    if (rand < 0.4) {
      // deal with client queued requests
      const clientReq = this.clientReqs.pop();
      if (clientReq) {
        const clientTrade = this.clientTrades.get(clientReq.clientTradeId);
        if (clientTrade && clientTrade.status == undefined && clientReq.action == "new") {
          log.info(`Progressing queued trade ${JSON.stringify(clientTrade)} to placed!`);
          clientTrade.status = "placed";
          await this.handleEvent(this.myPubkey, { ...clientTrade });
          if (Math.random() < 0.8) {
            log.info(`Progressing queued trade ${JSON.stringify(clientTrade)} to filled!`);
            clientTrade.status = "filled";
            await this.handleEvent(this.myPubkey, { ...clientTrade });
          } else {
            log.info(`Progressing queued trade ${JSON.stringify(clientTrade)} to cancelled!`);
            clientTrade.status = "cancelled";
            await this.handleEvent(this.myPubkey, { ...clientTrade });
          }
        } else if (clientTrade?.status == "filled" && clientReq.action == "close") {
          log.info(`Progressing queued trade ${JSON.stringify(clientTrade)} to closed!`);
          clientTrade.status = "closed";
          clientTrade.closePrice = randomPlusPerc(clientTrade.openPrice, 0.1);
          await this.handleEvent(this.myPubkey, { ...clientTrade });
        } else {
          throw new Error(`Unexpected queued trade: ${JSON.stringify(clientTrade)}, clientReq: ${JSON.stringify(clientReq)}`);
        }
      } else {
        log.info(`No client reqs, skipping!`);
      }
    } else {
      const asset = randomVal(this.assetMappings.map(({ asset }) => asset));
      const assetMapping = this.assetMappings.find((x) => x.asset == asset);
      const status = randomVal(["filled", "closed"]) as Status;
      const openPrice = randomPlusPerc(ASSET_PRICE_DEFAULT.get(asset), 0.1);
      const closePrice = status == "closed" ? randomPlusPerc(openPrice, 0.1) : undefined;
      let template: Trade = {
        asset,
        dir: randomVal(["buy", "sell"]) as Dir,
        owner: undefined,
        openPrice,
        closePrice,
        amount: assetMapping.cashAmount,
        leverage: assetMapping.leverage,
        tradeId: this.tickCnt,
        status,
      };

      if (rand < 0.6) {
        // issuing my trade with unknown ids
        const trade = { ...template, owner: this.myPubkey, clientTradeId: 1_234_567 };
        log.info(`mock tick ${this.tickCnt}, my trade: ${JSON.stringify(trade)}`);
        await this.handleEvent(this.myPubkey, trade);
      } else if (rand < 0.8) {
        // issuing random monitoredTrader event
        const trade = { ...template, owner: this.monitoredTrader };
        log.info(`mock tick ${this.tickCnt}, monitored trade: ${JSON.stringify(trade)}`);
        await this.handleEvent(this.monitoredTrader, trade);
      } else {
        const trade = { ...template, owner: this.bogusTrader };
        log.info(`mock tick ${this.tickCnt}, bogus trade: ${JSON.stringify(trade)}`);
        await this.handleEvent(this.bogusTrader, trade);
      }
    }
    this.tickCnt += 1;
  }

  randInd = 0;
  random(): number {
    // return Math.random();
    const results = [0.2, 0.2, 0.2, 0.2, 0.5, 0.7];
    const res = results[this.randInd];
    this.randInd = (this.randInd + 1) % results.length;
    return res;
  }
}
