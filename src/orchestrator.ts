// Orchestrates bot strategy

import { Config } from "./configuration";
import { State } from "./state";
import { Notifier } from "./notifications";
import { ITrader } from "./trader";
import { log } from "./log";
import { LockedRunner } from "./lock";
import { idCreator } from "./utils";
import { EventType, Order } from "./types";

export class Orchestrator {
  private config: Config;
  private state: State;
  private trader: ITrader;
  private notifier: Notifier;
  private assets: string[];
  private lockedRunner: LockedRunner;
  private idCreate = idCreator(Date.now());

  constructor(
    config: Config,
    state: State,
    trader: ITrader,
    notifier: Notifier
  ) {
    this.config = config;
    this.notifier = notifier;
    this.state = state;
    this.trader = trader;
    this.assets = Array.from(
      config.assets.map(({ gainsTicker }) => gainsTicker)
    );
    this.lockedRunner = new LockedRunner(config.lockingIntervalMs, this.assets);
  }

  async initialize() {
    // Setup feeds
    this.trader.subscribeMarkPrices((asset: string, price: number) => {
      const oldPrice = this.state.getPrice(asset);
      if (oldPrice?.price != price)
        log.debug(`Price update: ${asset}: ${price}`);
      // set regardless for stale checker
      this.state.setPrice(asset, price);
    });
  }

  async handleEvent(ownerPubkey: string, eventType: EventType, data) {
    const myPublicKey = this.config.wallet.publicKey;
    function createOrder(
      status: "issued" | "placed" | "cancelled" | "filled"
    ): Order {
      return {
        asset: data.asset,
        dir: data.dir,
        owner: data.owner,
        price: data.price,
        amount: data.amount,
        clientOrderId: data.clientOrderId,
        orderId: data.orderId,
        status: status,
      };
    }
    if (myPublicKey == ownerPubkey) {
      // record my order status/position
      switch (eventType) {
        case "orderPlaced":
          const o1 = createOrder("placed");
          this.state.setOrder(o1);
          log.info(`order received ${eventType}: ${JSON.stringify(o1)}`);
          this.notifier.publish(
            `Copy trade placed: ${o1.asset} ${o1.dir}: ${o1.amount} @ ${o1.price} (clientOrderId: ${o1.clientOrderId})`
          );
          break;
        case "orderCancelled":
          const o2 = createOrder("cancelled");
          this.state.setOrder(o2);
          log.info(`order received ${eventType}: ${JSON.stringify(o2)}`);
          this.notifier.publish(
            `Copy trade cancelled: ${o2.asset} ${o2.dir}: ${o2.amount} @ ${o2.price} (clientOrderId: ${o2.clientOrderId})`
          );
          break;
        case "orderFilled":
          const o3 = createOrder("filled");
          this.state.setOrder(o3);
          log.info(`order received ${eventType}: ${JSON.stringify(o3)}`);
          this.notifier.publish(
            `Copy trade filled: ${o3.asset} ${o3.dir}: ${o3.amount} @ ${o3.price} (clientOrderId: ${o3.clientOrderId})`
          );
          break;
        case "positionUpdate":
          log.info(`position received: ${JSON.stringify(data)}`);
          this.state.setPosition(data.asset, data.size);
          break;
      }
    } else if (
      this.config.monitoredTrader == ownerPubkey &&
      eventType == "orderFilled"
    ) {
      // copy trade
      const amount = data.amount; // FIXME, should set our own amounts
      const orderCopy = {
        asset: data.asset,
        dir: data.dir,
        amount,
        price: data.price,
        owner: this.config.wallet.publicKey,
        clientOrderId: this.idCreate(),
      };
      await this.trader.sendOrder(orderCopy);
      this.state.setOrder(orderCopy);
      log.info(`monitored order copy: ${JSON.stringify(orderCopy)}`);
    }
  }
}
