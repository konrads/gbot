// Orchestrates bot strategy

import { Config } from "./configuration";
import { State } from "./state";
import { Notifier } from "./notifications";
import { ITrader } from "./trader";
import { log } from "./log";
import { LockedRunner } from "./lock";
import { idCreator } from "./utils";
import { Address } from "./types";

export class Orchestrator {
  private config: Config;
  private state: State;
  private trader: ITrader;
  private notifier: Notifier;
  private symbols: string[];
  private lockedRunner: LockedRunner;
  private idCreate = idCreator(Date.now());

  constructor(config: Config, state: State, trader: ITrader, notifier: Notifier) {
    this.config = config;
    this.notifier = notifier;
    this.state = state;
    this.trader = trader;
    this.symbols = Array.from(config.symbolMappings.map(({ symbol }) => symbol));
    this.lockedRunner = new LockedRunner(config.lockingIntervalMs, this.symbols);
  }

  async initialize() {
    // Setup feeds
    this.trader.subscribeEvents(async (address: Address, event: any) => {
      await this.handleEvent(address, event);
    });
  }

  async handleEvent(ownerPubkey: string, event) {
    log.info(`Incoming event owned by ${ownerPubkey}: ${JSON.stringify(event)}`);

    const myPublicKey = this.config.wallet.address;
    const openTrade = this.state.openTrades.get(event.symbol);
    const amount = this.config.symbolMappings.find(({ symbol }) => symbol == event.symbol)?.cashAmount;
    const leverage = this.config.symbolMappings.find(({ symbol }) => symbol == event.symbol)?.leverage;

    if (ownerPubkey == myPublicKey) {
      const o = {
        symbol: event.symbol,
        dir: event.dir,
        owner: event.owner,
        openPrice: undefined,
        closePrice: undefined,
        amount: event.amount,
        leverage: event.leverage,
        clientTradeId: event.clientOrderId,
        tradeId: event.tradeId,
        status: event.status,
      };

      if (!openTrade?.status && event.status == "placed") {
        // record new trade
        o.status = "placed";
        this.state.setTrade(o);
        await this.notifier.publish(`My trade placed: ${JSON.stringify(o)}`);
      } else if (openTrade?.status == "placed" && event.status == "filled") {
        // fill
        o.openPrice = event.price;
        o.status = "filled";
        this.state.setTrade(o);
        await this.notifier.publish(`My trade filled: ${JSON.stringify(o)}`);
      } else if (openTrade?.status == "placed" && event.status == "cancelled") {
        // cancel
        o.status = "cancelled";
        this.state.setTrade(o);
        await this.notifier.publish(`My trade cancelled: ${JSON.stringify(o)}`);
      } else if (openTrade?.status == "filled" && event.status == "closed") {
        // close
        o.closePrice = event.price;
        o.status = "closed";
        this.state.setTrade(o);
        await this.notifier.publish(`My trade closed: ${JSON.stringify(o)}`);
      } else {
        log.warn(`Unexpected event ${JSON.stringify(event)} for current trade ${openTrade}`);
      }
    } else if (ownerPubkey == this.config.monitoredTrader) {
      if (!openTrade && event.status == "filled") {
        // issue a new trade
        const tradeCopy = {
          symbol: event.symbol,
          dir: event.dir,
          amount,
          leverage,
          openPrice: event.price,
          owner: myPublicKey,
          clientOrderId: this.idCreate(),
        };
        await this.trader.createTrade(tradeCopy);
        this.state.setTrade(tradeCopy);
      } else if (openTrade && event.status == "cancelled") {
        // issue trade cancel
        await this.trader.cancelTrade(event.clientTradeId);
      } else if (openTrade && event.status == "closed") {
        // issue trade close
        await this.trader.closeTrade(event.clientTradeId);
      }
    } else {
      log.info(`Ignoring event from unknown trader ${ownerPubkey}: ${JSON.stringify(event)}`);
    }
  }
}
