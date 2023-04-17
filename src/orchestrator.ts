// Orchestrates bot strategy

import { AssetMapping, Config } from "./configuration";
import { log } from "./log";
import { Dir, LedgerTrade } from "./types";
import { Mutex } from "async-mutex";
import { GTrade, Trade } from "./gtrade";
import { aggregateTrades, groupBy, sleep, toFixed, unique } from "./utils";
import { Notifier } from "./notifications";

export interface TradeEvent {
  pair: string;
  oraclePrice: number;
  dir?: Dir;
  cashAmount?: number;
  leverage?: number;
  open: boolean;
  stoploss?: boolean;
  msgId: string;
}

export interface NotifierEvent {
  notifierMsg: string;
}

export interface AssetState {
  currTrade?: LedgerTrade;
}

const MAX_WAIT_RETRIES = 10;
const WAIT_SLEEP_MS = 1_000;
const MIN_POSITION_SIZE = 900;

export class Orchestrator {
  private readonly assetStates: Map<string, AssetState>;
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
    this.assetStates = new Map(config.assetMappings.map((x): [string, AssetState] => [x.asset, {}]));
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
  async updateSnapshot(monitoredTrades: Trade[], tag: string) {
    // get my trades, compare to assetStates, generate {who, pair, dir, open }
    await this.mutex.runExclusive(async () => {
      const allPairs = this.config.assetMappings.map((x) => x.asset);
      // work with trades with lowest index per pair
      const myTrades = (await Promise.all(allPairs.map(async (p) => (await this.gtrader.getOpenTrades(p)).filter(({ index }) => index == 0)))).flat();
      const myPairs = unique([...this.assetStates.keys(), ...monitoredTrades.map((x) => x.pair), ...myTrades.map((x) => x.pair)]);

      // sync prices for most likely events. Note: could be smarter about this...
      const now = new Date();
      await Promise.all(
        myPairs.map(async (pair) => {
          const oraclePrice = await this.gtrader.getOraclePrice(pair);
          this.prices.set(pair, { price: oraclePrice, ts: now });
        })
      );

      const events = calcEvents(
        monitoredTrades,
        myTrades,
        this.prices,
        this._blockedToOpen,
        this.assetStates,
        this.config.assetMappings,
        now,
        tag,
        this._snapshotCnt == 0
      );

      // handle events
      if (events.length > 0)
        await Promise.all(
          events.map(async (event) => {
            if ("notifierMsg" in event) {
              this.notifier.publish(event.notifierMsg);
            } else {
              const state = this.assetStates.get(event.pair);

              log.info(`${event.msgId}: Following monitored event ${JSON.stringify(event)}`);
              if (event.open) {
                await this.gtrader.issueMarketTrade(event.pair, event.cashAmount, event.oraclePrice, event.leverage, event.dir, 0);
                log.info(`${event.msgId}: Issued opened trade @ ${event.oraclePrice}`);
                const myTrade = await this.waitOpenTrade(this.gtrader, event.pair, this.config.wallet.address, true);
                if (!myTrade) log.warn(`${event.msgId}: Failed to obtain a monitored trade, presuming trade was rejected`);
                else {
                  state.currTrade = {
                    dir: event.dir,
                    pair: event.pair,
                    size: event.cashAmount,
                    leverage: event.leverage,
                    openPrice: event.oraclePrice,
                    openTs: now,
                    boundaryPrice: event.oraclePrice,
                  };
                  this.notifier.publish(`${event.msgId}: Opened ${event.dir} of ${event.cashAmount} @ $${event.oraclePrice}`);
                }
              } else {
                await this.gtrader.closeTrade(event.pair, 0);
                const myTrade = await this.waitOpenTrade(this.gtrader, event.pair, this.config.wallet.address, false);
                if (!myTrade) {
                  state.currTrade = { ...state.currTrade, closePrice: event.oraclePrice, closeTs: now };
                  this.closedTrades.push({ ...state.currTrade });
                  this.notifier.publish(
                    `${event.msgId}: Closed ${state.currTrade.dir} of ${state.currTrade.size} @ $${state.currTrade.openPrice} - $${state.currTrade.closePrice}${
                      event.stoploss ? " due to stoploss" : ""
                    }`
                  );
                  this.assetStates.set(event.pair, {});
                } else throw new Error(`${event.msgId}: Failed to close!`);
              }
            }
          })
        );
      this._snapshotCnt += 1;
    });
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

export function calcEvents(
  monitoredTrades: Trade[],
  myTrades: Trade[],
  prices: Map<string, { price: number; ts: Date }>,
  blockedToOpen: Set<string>,
  assetStates: Map<string, AssetState>,
  assetMappings: AssetMapping[],
  now: Date,
  tag: string,
  initialRun?: boolean
): (TradeEvent | NotifierEvent)[] {
  const monitoredTradeByPair = new Map(groupBy(monitoredTrades, (x) => x.pair).map(([pair, trades]): [string, Trade] => [pair, aggregateTrades(trades)]));
  const myTradeByPair = new Map(myTrades.map((trade): [string, Trade] => [trade.pair, trade]));
  const allPairs = unique([...assetStates.keys(), ...monitoredTradeByPair.keys(), ...myTradeByPair.keys()]);

  log.debug(`Monitored trades: ${JSON.stringify([...monitoredTradeByPair.entries()])}\nMy trades: ${JSON.stringify([...myTradeByPair.entries()])}`);

  // sum up position size in monitoredTrades, ignoring trades under a limit in size * leverage (in case there's a short and long cancelling each other out)
  const insignificantlySmallPairs = [...monitoredTradeByPair.entries()]
    .filter(([_, trade]) => Math.abs(trade.positionSizeDai * trade.leverage) < MIN_POSITION_SIZE)
    .map(([pair, _]) => pair);
  for (var pair of insignificantlySmallPairs) {
    const msgId = `${pair}-${tag}`;
    const ignoredTrades = monitoredTrades.filter((t) => t.pair == pair);
    log.debug(`${msgId}: skipping trades as size * leverage < ${MIN_POSITION_SIZE}: ${JSON.stringify(ignoredTrades)}`);
    monitoredTradeByPair.delete(pair);
  }

  // sync up the state
  for (var pair of allPairs) {
    const msgId = `${pair}-${tag}`;
    const myTrade = myTradeByPair.get(pair);
    let state = assetStates.get(pair);
    if (myTrade && state.currTrade) {
      if ((myTrade.buy && state.currTrade.dir == "buy") || (!myTrade.buy && state.currTrade.dir == "sell")) {
        log.debug(`${msgId}: noop - matching myTrade and state`);
      } else {
        log.warn(`${msgId}: switching dir in state due to myTrade ${JSON.stringify(myTrade)}`);
        state.currTrade.dir = myTrade.buy ? "buy" : "sell";
      }
    } else if (!myTrade && state.currTrade) {
      log.warn(`${msgId}: mismatch, myTrade is gone (stoploss?), removing state and blocking`);
      blockedToOpen.add(pair);
      state.currTrade = undefined;
    } else if (myTrade && !state.currTrade) {
      log.warn(`${msgId}: mismatch, overwriting state with myTrade ${JSON.stringify(myTrade)}`);
      state.currTrade = {
        dir: myTrade.buy ? "buy" : "sell",
        pair: pair,
        size: myTrade.positionSizeDai,
        leverage: myTrade.leverage,
        openPrice: myTrade.openPrice,
        openTs: now,
        boundaryPrice: myTrade.openPrice,
      };
    }
  }

  // sync up with monitoredTrades
  const events: (TradeEvent | NotifierEvent)[] = [];
  for (var pair of allPairs) {
    const monitoredTrade = monitoredTradeByPair.get(pair);
    const state = assetStates.get(pair);
    const status = state.currTrade ? "open" : "idle";
    const msgId = `${pair}-${status}-${tag}`;

    if (!monitoredTrade && blockedToOpen.has(pair)) {
      events.push({ notifierMsg: `${msgId}: Unblocking` });
      blockedToOpen.delete(pair);
    }

    if (monitoredTrade && state.currTrade) {
      if ((monitoredTrade.buy && state.currTrade.dir == "buy") || (!monitoredTrade.buy && state.currTrade.dir == "sell")) {
        // validate stoploss with updated boundary price
        const oraclePrice = prices.get(pair).price;
        state.currTrade.boundaryPrice =
          state.currTrade.dir == "buy" ? Math.max(oraclePrice, state.currTrade.boundaryPrice) : Math.min(oraclePrice, state.currTrade.boundaryPrice);
        const maxStoploss = assetMappings.find(({ asset }) => asset == pair)?.trailingStoploss ?? 1;
        const stoploss = 1 - (state.currTrade.dir == "buy" ? oraclePrice / state.currTrade.boundaryPrice : state.currTrade.boundaryPrice / oraclePrice);
        const stoplossTriggered = stoploss > maxStoploss;
        if (stoplossTriggered) {
          log.debug(`${msgId}: triggered stoploss: ${stoploss} (max ${maxStoploss}), boundary ${state.currTrade.boundaryPrice}, oracle ${oraclePrice}`);
          blockedToOpen.add(pair);
          events.push({ notifierMsg: `${msgId}: blocked` });
          events.push({ pair, oraclePrice, open: false, stoploss: true, msgId });
        } else
          log.debug(
            `${msgId}: noop - matching monitoredTrade and state, trailing stoploss ${stoploss}, boundary ${state.currTrade.boundaryPrice}, oracle ${oraclePrice}`
          );
      } else {
        log.info(`${msgId}: unexpected dir, closing myTrade`);
        if (blockedToOpen.has(pair)) {
          events.push({ notifierMsg: `${msgId}: unblocked` });
          blockedToOpen.delete(pair);
        }
        const oraclePrice = prices.get(pair).price;
        events.push({ pair, oraclePrice, open: false, msgId });
      }
    } else if (!monitoredTrade && state.currTrade) {
      events.push({ notifierMsg: `${msgId}: monitoredTrade gone, closing myTrade` });
      if (blockedToOpen.has(pair)) {
        events.push({ notifierMsg: `${msgId}: unblocked` });
        blockedToOpen.delete(pair);
      }
      const oraclePrice = prices.get(pair).price;
      events.push({ pair, oraclePrice, open: false, msgId });
    } else if (monitoredTrade && !state.currTrade) {
      if (initialRun) {
        events.push({ notifierMsg: `${msgId}: blocking due to initial monitoredTrade ${JSON.stringify(monitoredTrade)}` });
        blockedToOpen.add(pair);
      }

      if (!state.currTrade) {
        const dir: "buy" | "sell" = monitoredTrade.buy ? "buy" : "sell";
        if (blockedToOpen.has(pair)) log.debug(`${msgId}: skipping blocked open event, dir ${dir}`);
        else {
          const configAsset = assetMappings.find((x) => x.asset == pair);
          events.push({
            pair,
            oraclePrice: prices.get(pair).price,
            cashAmount: configAsset.cashAmount,
            leverage: configAsset.leverage,
            dir,
            open: true,
            msgId,
          });
        }
      } else log.info(`${msgId}: Ignoring event close from monitored trader`);
    }
  }

  return events.filter((x) => x);
}
