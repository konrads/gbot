// Orchestrates bot strategy

import { Config } from "./configuration";
import { State } from "./state";
import { Notifier } from "./notifications";
import { ITrader } from "./trader";
import { log } from "./log";
import { idCreator } from "./utils";
import { Address, Trade } from "./types";
import { Mutex } from "async-mutex";

export class Orchestrator {
  private config: Config;
  private state: State;
  private trader: ITrader;
  private notifier: Notifier;
  private idCreate: () => number;
  private lock: Mutex;

  constructor(config: Config, state: State, trader: ITrader, notifier: Notifier, idCreate?: () => number) {
    this.config = config;
    this.notifier = notifier;
    this.state = state;
    this.trader = trader;
    this.idCreate = idCreate ?? idCreator(Date.now());
    this.lock = new Mutex();
  }

  async initialize() {
    // Setup feeds
    this.trader.subscribeEvents(async (address: Address, event: Trade) => {
      await this.handleEvent(address, event);
    });
  }

  async handleEvent(ownerPubkey: string, event: Trade) {
    log.info(`Incoming event owned by ${ownerPubkey}: ${JSON.stringify(event)}`);

    let effectRunner: () => Promise<void> = async () => {};

    await this.lock.runExclusive(async () => {
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
          clientTradeId: event.clientTradeId,
          tradeId: event.tradeId,
          status: event.status,
        };

        if (!openTrade?.status && event.status == "placed") {
          // record new trade
          o.status = "placed";
          this.state.setTrade(o);
          effectRunner = async () => await this.notifier.publish(`My trade placed: ${JSON.stringify(o)}`);
        } else if (openTrade?.status == "placed" && event.status == "filled") {
          // fill
          o.openPrice = event.openPrice;
          o.status = "filled";
          this.state.setTrade(o);
          effectRunner = async () => await this.notifier.publish(`My trade filled: ${JSON.stringify(o)}`);
        } else if (openTrade?.status == "placed" && event.status == "cancelled") {
          // cancel
          o.status = "cancelled";
          this.state.setTrade(o);
          effectRunner = async () => await this.notifier.publish(`My trade cancelled: ${JSON.stringify(o)}`);
        } else if (openTrade?.status == "filled" && event.status == "closed") {
          // close
          o.closePrice = event.closePrice;
          o.status = "closed";
          this.state.setTrade(o);
          effectRunner = async () => await this.notifier.publish(`My trade closed: ${JSON.stringify(o)}`);
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
            openPrice: event.openPrice,
            owner: myPublicKey,
            clientTradeId: this.idCreate(),
          };
          this.state.setTrade(tradeCopy);
          effectRunner = async () => await this.trader.createTrade(tradeCopy);
        } else if (openTrade && event.status == "cancelled") {
          // issue trade cancel
          effectRunner = async () => await this.trader.cancelTrade(openTrade.clientTradeId);
        } else if (openTrade && event.status == "closed") {
          // issue trade close
          effectRunner = async () => await this.trader.closeTrade(openTrade.clientTradeId);
        }
      } else {
        log.info(`Ignoring event from unknown trader ${ownerPubkey}: ${JSON.stringify(event)}`);
      }
    });

    // run effects outside of mutex lock
    await effectRunner();
  }
}
