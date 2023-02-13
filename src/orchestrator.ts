// Orchestrates bot strategy

import { Config } from "./configuration";
import { State } from "./state";
import { Notifier } from "./notifications";
import { Trader } from "./trader";
import { log } from "./log";
import { LockedRunner } from "./lock";
import { idCreator } from "./utils";
import { Order } from "./types";

export class Orchestrator {
  private config: Config;
  private state: State;
  private trader: Trader;
  private notifier: Notifier;
  private assets: string[];
  private lockedRunner: LockedRunner;
  private idCreate = idCreator(Date.now());

  constructor(
    config: Config,
    state: State,
    trader: Trader,
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

  async handleEvent(
    ownerPubkey: string,
    eventType:
      | "orderPlaced"
      | "orderCancelled"
      | "orderFilled"
      | "positionUpdate",
    data
  ) {
    const myPublicKey = this.config.wallet.publicKey;
    function createOrder(
      status: "issued" | "placed" | "cancelled" | "filled"
    ): Order {
      return {
        asset: data.asset,
        dir: data.dir,
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
          this.state.setOrder(createOrder("placed"));
          break;
        case "orderCancelled":
          this.state.setOrder(createOrder("cancelled"));
          break;
        case "orderFilled":
          this.state.setOrder(createOrder("filled"));
          break;
        case "positionUpdate":
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
        clientOrderId: this.idCreate(),
      };
      await this.trader.sendOrder(orderCopy);
      this.state.setOrder(createOrder("issued"));
    }
  }
}
