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
  async updateSnapshot(monitoredTrades: Trade[], origin: string) {
    // get my trades, compare to assetStates, generate {who, pair, dir, open }
    const allPairs = this.config.assetMappings.map((x) => x.asset);
    await this.mutex.runExclusive(async () => {
      // work with trades with lowest index per pair
      const myTrades = (await Promise.all(allPairs.map(async (p) => (await this.gtrader.getOpenTrades(p)).filter(({ index }) => index == 0)))).flat();
      const myTradeByPair = new Map(myTrades.map((trade): [string, Trade] => [trade.pair, trade]));

      // sum up position size in monitoredTrades, ignoring trades under a limit in size * leverage (in case there's a short and long cancelling each other out)
      const monitoredTradeByPair = new Map(groupBy(monitoredTrades, (x) => x.pair).map(([pair, trades]): [string, Trade] => [pair, aggregateTrades(trades)]));
      log.debug(`Monitored trades: ${JSON.stringify([...monitoredTradeByPair.entries()])}\nMy trades: ${JSON.stringify([...myTradeByPair.entries()])}`);
      const ignoredPairs = [...monitoredTradeByPair.entries()]
        .filter(([_, trade]) => Math.abs(trade.positionSizeDai * trade.leverage) < MIN_POSITION_SIZE)
        .map(([pair, _]) => pair);
      for (var pair of ignoredPairs) {
        const msgId = `${pair}-${origin}`;
        const ignoredTrades = monitoredTrades.filter((t) => t.pair == pair);
        log.debug(`${msgId}: skipping trades as size * leverage < ${MIN_POSITION_SIZE}: ${JSON.stringify(ignoredTrades)}`);
        monitoredTradeByPair.delete(pair);
      }

      // sync prices for most likely events. Note: could be smarter about this...
      await Promise.all(
        allPairs
          .filter((pair) => monitoredTradeByPair.has(pair) || myTradeByPair.has(pair))
          .map(async (pair) => {
            const oraclePrice = await this.gtrader.getOraclePrice(pair);
            this.prices.set(pair, { price: oraclePrice, ts: new Date() });
          })
      );

      // sync up the state
      for (var pair of allPairs) {
        const msgId = `${pair}-${origin}`;
        const myTrade = myTradeByPair.get(pair);
        let state = this.assetStates.get(pair);
        if (!state) {
          state = {};
          this.assetStates.set(pair, state);
        }

        if (myTrade && state.currTrade) {
          if ((myTrade.buy && state.currTrade.dir == "buy") || (!myTrade.buy && state.currTrade.dir == "sell")) {
            log.debug(`${msgId}: noop - matching myTrade and state`);
          } else {
            log.warn(`${msgId}: switching dir in state due to myTrade ${JSON.stringify(myTrade)}`);
            state.currTrade.dir = myTrade.buy ? "buy" : "sell";
          }
        } else if (!myTrade && state.currTrade) {
          log.warn(`${msgId}: mismatch, myTrade is gone (stoploss?), removing state and blocking`);
          this._blockedToOpen.add(pair);
          state.currTrade = undefined;
        } else if (myTrade && !state.currTrade) {
          log.warn(`${msgId}: mismatch, overwriting state with myTrade ${JSON.stringify(myTrade)}`);
          state.currTrade = {
            dir: myTrade.buy ? "buy" : "sell",
            pair: pair,
            size: myTrade.positionSizeDai,
            leverage: myTrade.leverage,
            openPrice: myTrade.openPrice,
            openTs: new Date(),
            boundaryPrice: myTrade.openPrice,
          };
        }
      }

      // sync up with monitoredTrades
      const events = allPairs
        .map((pair) => {
          const msgId = `${pair}-${origin}`;
          const monitoredTrade = monitoredTradeByPair.get(pair);
          const state = this.assetStates.get(pair);
          if (!monitoredTrade && this._blockedToOpen.has(pair)) {
            this.notifier.publish(`${msgId}: Unblocking`);
            this._blockedToOpen.delete(pair);
          }

          if (monitoredTrade && state.currTrade) {
            if ((monitoredTrade.buy && state.currTrade.dir == "buy") || (!monitoredTrade.buy && state.currTrade.dir == "sell")) {
              // validate stoploss with updated boundary price
              const oraclePrice = this.prices.get(pair).price;
              state.currTrade.boundaryPrice =
                state.currTrade.dir == "buy" ? Math.max(oraclePrice, state.currTrade.boundaryPrice) : Math.min(oraclePrice, state.currTrade.boundaryPrice);
              const maxStoploss = this.config.assetMappings.find(({ asset }) => asset == pair)?.trailingStoploss ?? 1;
              const stoploss = 1 - (state.currTrade.dir == "buy" ? oraclePrice / state.currTrade.boundaryPrice : state.currTrade.boundaryPrice / oraclePrice);
              const stoplossTriggered = stoploss > maxStoploss;
              if (stoplossTriggered) {
                log.debug(
                  `${msgId}: triggered stoploss: ${stoploss} (max ${maxStoploss}), boundary ${state.currTrade.boundaryPrice}, oracle price ${oraclePrice}`
                );
                return { pair, oraclePrice, open: false, stoploss: true };
              } else
                log.debug(
                  `${msgId}: noop - matching monitoredTrade and state, trailing stoploss ${stoploss} (max ${maxStoploss}), boundary ${state.currTrade.boundaryPrice}, oracle price ${oraclePrice}`
                );
            } else {
              log.info(`${msgId}: unexpected dir, closing myTrade`);
              const oraclePrice = this.prices.get(pair).price;
              return { pair, oraclePrice, open: false };
            }
          } else if (!monitoredTrade && state.currTrade) {
            this.notifier.publish(`${msgId}: monitoredTrade gone, closing myTrade`);
            const oraclePrice = this.prices.get(pair).price;
            return { pair, oraclePrice, open: false };
          } else if (monitoredTrade && !state.currTrade) {
            if (this._snapshotCnt == 0) {
              this.notifier.publish(`${msgId}: blocking due to initial monitoredTrade ${JSON.stringify(monitoredTrade)}`);
              this._blockedToOpen.add(pair);
            }
            const oraclePrice = this.prices.get(pair).price;
            return { pair, oraclePrice, dir: (monitoredTrade.buy ? "buy" : "sell") as "buy" | "sell", open: true };
          }
        })
        .filter((x) => x);
      if (events.length > 0) await Promise.all(events.map(async (x) => await this._handleEvent(x, origin)));
      this._snapshotCnt += 1;
    });
  }

  private async _handleEvent(event: { pair: string; oraclePrice: number; dir?: Dir; open: boolean; stoploss?: boolean }, origin: string) {
    const configAsset = this.config.assetMappings.find((x) => x.asset == event.pair);
    if (!configAsset) log.debug(`...Ignoring unsupported event pair ${event.pair}`);
    else {
      let state = this.assetStates.get(event.pair);
      if (!state) {
        state = {};
        this.assetStates.set(event.pair, state);
      }

      const status = state.currTrade ? "open" : "idle";
      const msgId = `${event.pair}-${status}-${origin}`;
      const now = new Date();

      switch (status) {
        case "idle":
          if (event.open) {
            if (this._blockedToOpen.has(event.pair)) log.debug(`${msgId}: skipping blocked open event ${JSON.stringify(event)}`);
            else {
              log.info(`${msgId}: Following monitored event ${JSON.stringify(event)}`);
              await this.gtrader.issueMarketTrade(event.pair, configAsset.cashAmount, event.oraclePrice, configAsset.leverage, event.dir, 0);
              this.prices.set(event.pair, { price: event.oraclePrice, ts: now });
              log.info(`${msgId}: Issued opened trade @ ${event.oraclePrice}`);
              const myTrade = await this.waitOpenTrade(this.gtrader, event.pair, this.config.wallet.address, true);
              if (!myTrade) log.warn(`${msgId}: Failed to obtain a monitored trade, presuming trade was rejected`);
              else {
                state.currTrade = {
                  dir: myTrade.buy ? "buy" : "sell",
                  pair: event.pair,
                  size: configAsset.cashAmount,
                  leverage: configAsset.leverage,
                  openPrice: event.oraclePrice,
                  openTs: now,
                  boundaryPrice: event.oraclePrice,
                };
                this.notifier.publish(`${msgId}: Opened ${event.dir} of ${configAsset.cashAmount} @ $${event.oraclePrice}`);
              }
            }
          } else log.info(`${msgId}: Ignoring event close from ${this.config.monitoredTrader}`);
          break;
        case "open":
          if (!event.open) {
            log.info(`${msgId}: Following monitored event ${JSON.stringify(event)}`);
            if (event.stoploss) this._blockedToOpen.add(event.pair);
            else if (this._blockedToOpen.has(event.pair)) {
              this.notifier.publish(`${msgId}: unblocked`);
              this._blockedToOpen.delete(event.pair);
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
                `${msgId}: Closed ${state.currTrade.dir} of ${state.currTrade.size} @ $${state.currTrade.openPrice} - $${state.currTrade.closePrice}${
                  event.stoploss ? " due to stoploss" : ""
                }`
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
