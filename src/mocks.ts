// places new orders
// fills and cancels orders existing
// updates positions as per fills

import { MockParams } from "./configuration";
import { log } from "./log";
import { State } from "./state";
import { Trader } from "./trader";
import { Dir, EventType, Order, Status } from "./types";
import { randomVal } from "./utils";

export class MockTrader {
  private readonly trader: Trader;
  private readonly mockExchange: MockExchange;

  constructor(trader: Trader, mockExchange: MockExchange) {
    this.trader = trader;
    this.mockExchange = mockExchange;
  }

  async sendOrder(order: Order): Promise<void> {
    return await this.mockExchange.registerOrder(order);
  }

  async subscribeMarkPrices(callback: (string, number) => void) {
    return await this.trader.subscribeMarkPrices(callback);
  }

  async shutdown() {
    return await this.trader.shutdown();
  }
}

export class MockExchange {
  private monitoredTrader: string;
  private params: MockParams;
  private handleEvent: (
    ownerPubkey: string,
    eventType: EventType,
    data
  ) => Promise<void>;
  private state: State;
  private orders: Order[] = [];
  private assets: string[];
  private myPubkey: string;
  private tick: number = 0;

  constructor(
    state: State,
    monitoredTrader: string,
    params: MockParams,
    assets: string[],
    myPubkey: string
  ) {
    this.state = state;
    this.monitoredTrader = monitoredTrader;
    this.params = params;
    this.assets = assets;
    this.myPubkey = myPubkey;
  }

  initialize(
    handler: (ownerPubkey: string, eventType: EventType, data) => Promise<void>
  ) {
    this.handleEvent = handler;
    setInterval(() => this.refresh(), 1000); // refresh every sec
  }

  async registerOrder(order: Order): Promise<void> {
    this.orders.push(order);
  }

  refresh() {
    log.debug(`mock tick ${this.tick}`);
    const shouldCloseOrders = this.tick % this.params.fillCancelTrigger == 0;
    if (shouldCloseOrders) {
      const newStatus =
        Math.random() < this.params.fillCancelPerc ? "filled" : "cancelled";
      const closables = this.orders.filter((x) => {
        const status = x.status ?? "issued";
        return status != "filled" && status != "cancelled";
      });
      closables.forEach((x) => {
        x.status = newStatus;
        this.handleEvent(
          x.owner,
          newStatus == "filled" ? "orderFilled" : "orderCancelled",
          x
        );
        if (newStatus == "filled" && x.owner == this.myPubkey) {
          const position =
            (this.state.getPosition(x.asset) ?? 0) +
            (x.dir == "buy" ? x.amount : -x.amount);
          this.state.setPosition(x.asset, position);
        }
      });
    }
    const shouldIssueOtherTraderOrders =
      this.tick % this.params.otherTraderTrigger == 0;
    if (shouldIssueOtherTraderOrders) {
      const trader =
        Math.random() < this.params.otherTraderPerc
          ? this.monitoredTrader
          : "other-trader-pubkey";
      const asset = randomVal(this.assets);
      const order = {
        asset,
        dir: randomVal(["buy", "sell"]) as Dir,
        owner: trader,
        price: this.state.getPrice(asset)?.price,
        amount: Math.random() * 10,
        orderId: this.tick,
        status: "filled" as Status,
      };
      this.registerOrder(order);
      this.handleEvent(trader, "orderFilled", order);
    }
    this.tick += 1;
  }
}
