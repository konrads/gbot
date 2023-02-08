// Orchestrates bot strategy

import { Config } from "./configuration";
import { State } from "./state";
import { Notifier } from "./notifications";
import { Trader } from "./trader";
import { log } from "./log";
import { LockedRunner } from "./lock";

export class Orchestrator {
  private config: Config;
  private state: State;
  private trader: Trader;
  private notifier: Notifier;
  private assets: string[];
  private lockedRunner: LockedRunner;

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
}
