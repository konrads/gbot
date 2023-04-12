// Orchestrates bot strategy

import { Config } from "./configuration";
import { log } from "./log";
import { Dir, LedgerTrade } from "./types";
import { Mutex } from "async-mutex";
import { GTrade, Trade } from "./gtrade";
import { aggregateTrades, groupBy, sleep, toFixed } from "./utils";
import { Notifier } from "./notifications";

interface AssetState {
  currTrade?: LedgerTrade;
}

const MAX_WAIT_RETRIES = 10;
const WAIT_SLEEP_MS = 1_000;
const MIN_POSITION_SIZE = 900;

export class Orchestrator {
  private readonly assetStates: Map<string, AssetState> = new Map();
  private readonly config: Config;
  private readonly gtrader: GTrade;
  private readonly notifier: Notifier;
  private readonly mutex: Mutex = new Mutex();
  private readonly closedTrades: LedgerTrade[] = [];
  private readonly prices: Map<string, { price: number; ts: Date }> = new Map();
  // blockedToOpen criteria:
  // - snapshot suggests to open AND (snapshotCnt == 0 OR already blocked) -> blocked ... ie. potentially opened a while ago?
  // - else -> unblocked
  private _blockedToOpen: Set<string> = new Set();
  private _snapshotCnt = 0;
  private _healthCheck: string = "--";
  private _healthCheckCnt = 0;

  constructor(config: Config, gtrader: GTrade, notifier: Notifier) {
    this.config = config;
    this.gtrader = gtrader;
    this.notifier = notifier;
  }

  async updateHealthCheck(): Promise<void> {
    this._healthCheckCnt += 1;
    this._healthCheck = `${this._healthCheckCnt}, eth/matic: ${toFixed(await this.gtrader.getBalance(), 4)} dai: ${toFixed(
      await this.gtrader.getDaiBalance(),
      2
    )} openTrades: ${[...(await this.gtrader.getOpenTradeCounts()).entries()].map(([k, v]) => `${k}:${v}`)}`;
  }

  get healthCheck(): string {
    return this._healthCheck;
  }

  // Presuming the monitoredTrades to be per-pair indications of position change
  async updateSnapshot(monitoredTrades: Trade[]) {
    // get my trades, compare to assetStates, generate {who, pair, dir, open }
    const allPairs = this.config.assetMappings.map((x) => x.asset);
    await this.mutex.runExclusive(async () => {
      // work with trades with lowest index per pair
      const myTrades = (await Promise.all(allPairs.map(async (p) => (await this.gtrader.getOpenTrades(p)).filter(({ index }) => index == 0)))).flat();
      const myTradeByPair = new Map(myTrades.map((trade): [string, Trade] => [trade.pair, trade]));

      // sum up position size in monitoredTrades, ignoring trades under a limit in size * leverage (in case there's a short and long cancelling each other out)
      const monitoredTradeByPair = new Map(groupBy(monitoredTrades, (x) => x.pair).map(([pair, trades]): [string, Trade] => [pair, aggregateTrades(trades)]));
      log.debug(`Monitored trades: ${JSON.stringify([...monitoredTradeByPair.entries()])}`);
      log.debug(`My trades: ${JSON.stringify([...myTradeByPair.entries()])}`);
      const ignoredPairs = [...monitoredTradeByPair.entries()]
        .filter(([_, trade]) => Math.abs(trade.positionSizeDai * trade.leverage) < MIN_POSITION_SIZE)
        .map(([pair, _]) => pair);
      for (var pair of ignoredPairs) {
        const ignoredTrades = monitoredTrades.filter((t) => t.pair == pair);
        log.debug(`${pair}: skipping trades as size * leverage < ${MIN_POSITION_SIZE}: ${JSON.stringify(ignoredTrades)}`);
        monitoredTradeByPair.delete(pair);
      }

      // sync up the state
      for (var pair of allPairs) {
        const myTrade = myTradeByPair.get(pair);
        let state = this.assetStates.get(pair);
        if (!state) {
          state = {};
          this.assetStates.set(pair, state);
        }

        if (myTrade && state.currTrade) {
          if ((myTrade.buy && state.currTrade.dir == "buy") || (!myTrade.buy && state.currTrade.dir == "sell")) {
            log.debug(`${pair}: noop - matching myTrade and state`);
          } else {
            log.warn(`${pair}: switching dir in state due to myTrade ${JSON.stringify(myTrade)}`);
            state.currTrade.dir = myTrade.buy ? "buy" : "sell";
          }
        } else if (!myTrade && state.currTrade) {
          log.warn(`${pair}: mismatch, have no myTrade, removing state ${JSON.stringify(state)}`);
          state.currTrade = undefined;
        } else if (myTrade && !state.currTrade) {
          log.warn(`${pair}: mismatch, have myTrade ${JSON.stringify(myTrade)}, fixing up state ${JSON.stringify(state)}`);
          state.currTrade = {
            dir: myTrade.buy ? "buy" : "sell",
            pair: pair,
            size: myTrade.positionSizeDai,
            leverage: myTrade.leverage,
            openPrice: myTrade.openPrice,
            openTs: new Date(),
          };
        }
      }

      // sync up with monitoredTrades
      const events = allPairs
        .map((pair) => {
          const monitoredTrade = monitoredTradeByPair.get(pair);
          const state = this.assetStates.get(pair);
          if (!monitoredTrade && this._blockedToOpen.has(pair)) {
            log.info(`${pair}: Unblocking`);
            this._blockedToOpen.delete(pair);
          }

          if (monitoredTrade && state.currTrade) {
            if ((monitoredTrade.buy && state.currTrade.dir == "buy") || (!monitoredTrade.buy && state.currTrade.dir == "sell")) {
              log.debug(`${pair}: noop - matching monitoredTrade and state`);
            } else {
              log.info(`${pair}: unexpected dir, closing myTrade`);
              return { who: "monitored", pair, open: false };
            }
          } else if (!monitoredTrade && state.currTrade) {
            log.info(`${pair}: monitoredTrade gone, closing myTrade`);
            return { pair, open: false };
          } else if (monitoredTrade && !state.currTrade) {
            // log.info(`${pair}: following monitoredTrade ${JSON.stringify(monitoredTrade)}`);
            if (this._snapshotCnt == 0) {
              log.info(`${pair}: blocking due to initial monitoredTrade ${JSON.stringify(monitoredTrade)}`);
              this._blockedToOpen.add(pair);
            }
            return { pair, dir: (monitoredTrade.buy ? "buy" : "sell") as "buy" | "sell", open: true };
          }
        })
        .filter((x) => x);
      if (events.length > 0) await Promise.all(events.map(async (x) => await this._handleEvent(x)));
      this._snapshotCnt += 1;
    });
  }

  private async _handleEvent(event: { pair: string; dir?: Dir; open: boolean }) {
    const configAsset = this.config.assetMappings.find((x) => x.asset == event.pair);
    if (!configAsset) log.debug(`...Ignoring unsupported event pair ${event.pair}`);
    else {
      let state = this.assetStates.get(event.pair);
      if (!state) {
        state = {};
        this.assetStates.set(event.pair, state);
      }

      const status = state.currTrade ? "open" : "idle";
      const msgId = `${event.pair}-${status}`;
      const now = new Date();

      switch (status) {
        case "idle":
          if (event.open) {
            if (this._blockedToOpen.has(event.pair)) log.info(`${msgId}: skipping blocked open event ${JSON.stringify(event)}`);
            else {
              log.info(`${msgId}: Following monitored event ${JSON.stringify(event)}`);
              const oraclePrice = await this.gtrader.getOraclePrice(event.pair);
              await this.gtrader.issueMarketTrade(event.pair, configAsset.cashAmount, oraclePrice, configAsset.leverage, event.dir, 0);
              this.prices.set(event.pair, { price: oraclePrice, ts: now });
              log.info(`${msgId}: Issued opened trade @ ${oraclePrice}`);
              const myTrade = await this.waitOpenTrade(this.gtrader, event.pair, this.config.wallet.address, true);
              log.info(`${msgId}: Found ${myTrade != undefined} confirmed trades`);
              if (!myTrade) log.warn(`${msgId}: Failed to obtain a monitored trade, presuming trade was rejected`);
              else {
                state.currTrade = {
                  dir: myTrade.buy ? "buy" : "sell",
                  pair: event.pair,
                  size: configAsset.cashAmount,
                  leverage: configAsset.leverage,
                  openPrice: oraclePrice,
                  openTs: now,
                };
                this.notifier.publish(`${msgId}: Opened ${event.dir} of ${configAsset.cashAmount} @ $${oraclePrice}`);
                log.info(`${msgId}: Monitored order mirrored`);
              }
            }
          } else log.info(`${msgId}: Ignoring event close from ${this.config.monitoredTrader}`);
          break;
        case "open":
          if (!event.open) {
            log.info(`${msgId}: Following monitored event ${JSON.stringify(event)}`);
            if (this._blockedToOpen.has(event.pair)) {
              this._blockedToOpen.delete(event.pair);
              log.info(`${msgId}: unblocked`);
            }
            await this.gtrader.closeTrade(event.pair, 0);
            const oraclePrice = await this.gtrader.getOraclePrice(event.pair);
            this.prices.set(event.pair, { price: oraclePrice, ts: new Date() });
            const myTrade = await this.waitOpenTrade(this.gtrader, event.pair, this.config.wallet.address, false);
            if (!myTrade) {
              state.currTrade.closePrice = oraclePrice;
              state.currTrade.closeTs = now;
              this.closedTrades.push({ ...state.currTrade });
              this.notifier.publish(
                `${msgId}: Closed ${state.currTrade.dir} of ${state.currTrade.size} @ $${state.currTrade.openPrice} - $${state.currTrade.closePrice}`
              );
              this.assetStates.set(event.pair, {});
            } else throw new Error(`${msgId}: Failed to close!`);
          } else log.info(`${msgId}: Ignoring event ${JSON.stringify(event)}`);
          break;
      }
    }
  }

  get myClosedTrades(): LedgerTrade[] {
    return this.closedTrades;
  }

  get pairPrices(): Map<string, { price: number; ts: Date }> {
    return this.prices;
  }

  get snapshotCnt(): number {
    return this._snapshotCnt;
  }

  get blockedToOpen(): Set<string> {
    return this._blockedToOpen;
  }

  private async waitOpenTrade(gTrade: GTrade, pair: string, trader: string, expectExist: boolean): Promise<Trade> {
    let trade0: Trade;
    for (var i = 0; i < MAX_WAIT_RETRIES; i++) {
      trade0 = (await gTrade.getOpenTrades(pair, trader)).find((t) => t.index == 0);
      log.info(`...${pair}::${trader}: got trade ${trade0 != undefined}, expectSome: ${expectExist}`);
      if ((trade0 && expectExist) || (!trade0 && !expectExist)) return trade0;
      else await sleep(WAIT_SLEEP_MS);
    }
    return trade0;
  }
}
