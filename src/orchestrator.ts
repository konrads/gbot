// Orchestrates bot strategy

import { Config } from "./configuration";
import { log } from "./log";
import { LedgerTrade, MarketOrderInitiated } from "./types";
import { Mutex } from "async-mutex";
import { GTrade, Trade } from "./gtrade";
import { shortPubkey, sleep } from "./utils";

interface State {
  status: "idle" | "open";
  trade?: LedgerTrade;
}

const MAX_SLEEPS = 60;
const SLEEP_MS = 1000;

export class Orchestrator {
  private readonly states: Map<string, State> = new Map();
  private readonly gtrade: GTrade;
  private readonly config: Config;
  private readonly mutex: Mutex = new Mutex();
  private readonly closedTrades: LedgerTrade[] = [];
  private readonly prices: Map<string, { price: number; ts: Date }> = new Map();

  constructor(gtrade: GTrade, config: Config) {
    this.gtrade = gtrade;
    this.config = config;
  }

  async handleMonitoredEvent(event: MarketOrderInitiated) {
    return await this.mutex.runExclusive(async () => {
      let state = this.states.get(event.pair);
      if (!state) {
        state = {
          status: "idle",
        };
        this.states.set(event.pair, state);
      }

      switch (state.status) {
        case "idle":
          if (event.open) {
            // FIXME: source from config!!!
            const size = 100;
            const leverage = 20;
            //
            // FIXME!!!;
            //
            log.info(`${state.status}-${event.pair}: Following monitored event ${JSON.stringify(event)}`);
            const monitoredTrades = await this.waitOpenTrades(event.pair, event.trader, true);
            if (monitoredTrades.length == 0) {
              log.warn(`${state.status}-${event.pair}: Not seeing any open trades for trader ${shortPubkey(event.trader)}, staying idle`);
            } else {
              const firstTrade = monitoredTrades.find((x) => x.index == 0);
              log.info(`${state.status}-${event.pair}: Following monitored trade ${JSON.stringify(firstTrade)}`);
              const dir = firstTrade.buy ? "buy" : "sell";
              const [openPrice] = await this.gtrade.issueMarketTrade(firstTrade.pair, size, leverage, dir);
              const now = new Date();
              this.prices.set(event.pair, { price: openPrice, ts: now });
              log.info(`${state.status}-${event.pair}: Issued opened trade @ ${openPrice}`);
              const myTrades = await this.waitOpenTrades(event.pair, this.config.wallet.address, true);
              log.info(`${state.status}-${event.pair}: Found ${myTrades.length} confirmed trades`);
              if (myTrades.length == 0) log.warn(`${state.status}-${event.pair}: Failed to obtain a monitored trade, presuming trade was rejected`);
              else {
                const latestMyTrade = myTrades[myTrades.length - 1];
                state.trade = {
                  dir: latestMyTrade.buy ? "buy" : "sell",
                  pair: event.pair,
                  size: size,
                  leverage: leverage,
                  openPrice: openPrice,
                  openTs: now,
                };
                log.info(`${state.status}-${event.pair}: Opened ${dir} of ${size} @ $${openPrice}`);
                state.status = "open";
              }
            }
          } else log.info(`${state.status}-${event.pair}: Ignoring event close from ${shortPubkey(event.trader)}`);
          break;
        case "open":
          if (!event.open) {
            log.info(`${state.status}-${event.pair}: Following monitored event ${JSON.stringify(event)}`);
            // NOTE: not validating a monitored trade was actually closed
            const [closePrice] = await this.gtrade.closeTrade(event.pair);
            this.prices.set(event.pair, { price: closePrice, ts: new Date() });
            const myTrades = await this.waitOpenTrades(event.pair, this.config.wallet.address, false);
            if (myTrades.length == 0) {
              const now = new Date();
              state.trade.closePrice = closePrice;
              state.trade.closeTs = now;
              this.closedTrades.push(state.trade);
              this.states.set(event.pair, { status: "idle" });
              log.info(
                `${state.status}-${event.pair}: Closed ${state.trade.dir} of ${state.trade.size} @ $${state.trade.openPrice} - $${state.trade.closePrice}`
              );
            } else throw new Error(`${state.status}-${event.pair}: Failed to close!`);
          } else log.info(`${state.status}-${event.pair}: Ignoring event ${JSON.stringify(event)}`);
          break;
        default:
          throw new Error(`Unknown state ${state.status}`);
      }
    });
  }

  get myClosedTrades(): LedgerTrade[] {
    return this.closedTrades;
  }

  get assetPrices(): Map<string, { price: number; ts: Date }> {
    return this.prices;
  }

  private async waitOpenTrades(pair: string, trader: string, expectSome: boolean): Promise<Trade[]> {
    let trades = [];
    for (var i = 0; i < MAX_SLEEPS; i++) {
      trades = await this.gtrade.getOpenTrades(pair, trader);
      log.info(`...${pair}::${shortPubkey(trader)}: got ${trades.length}, expectSome: ${expectSome}`);
      switch (trades.length) {
        case 0:
          if (expectSome) await sleep(SLEEP_MS);
          else return trades;
          break;
        default:
          if (expectSome) return trades;
          else await sleep(SLEEP_MS);
          break;
      }
    }
    return trades;
  }
}
