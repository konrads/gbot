// Orchestrates bot strategy

import { Config } from "./configuration";
import { log } from "./log";
import { LedgerTrade, MarketOrderInitiated } from "./types";
import { Mutex } from "async-mutex";
import { GTrade, Trade } from "./gtrade";
import { shortPubkey, sleep, unique } from "./utils";
import { Notifier } from "./notifications";

interface AssetState {
  status: "idle" | "open";
  trade?: LedgerTrade;
}

const MAX_WAIT_RETRIES = 60;
const WAIT_SLEEP_MS = 1000;

export class Orchestrator {
  private readonly assetStates: Map<string, AssetState> = new Map();
  private readonly config: Config;
  private readonly gtrade: GTrade;
  private readonly notifier: Notifier;
  private readonly mutex: Mutex = new Mutex();
  private readonly closedTrades: LedgerTrade[] = [];
  private readonly prices: Map<string, { price: number; ts: Date }> = new Map();
  // blockedToOpen criteria:
  // - snapshot suggests to open AND (snapshotCnt == 0 OR already blocked) -> blocked ... ie. potentially opened a while ago?
  // - else -> unblocked
  private blockedToOpen: Set<string> = new Set();
  private snapshotCnt = 0;

  constructor(config: Config, gtrade: GTrade, notifier: Notifier) {
    this.config = config;
    this.gtrade = gtrade;
    this.notifier = notifier;
    this.blockedToOpen = new Set(config.assetMappings.map((x) => x.asset));
  }

  async updateSnapshot(myTrades: Trade[], monitoredTrades: Trade[]) {
    const myTradeByPair: Map<string, Trade> = new Map(myTrades.filter(({ index }) => index == 0).map((trade): [string, Trade] => [trade.pair, trade]));
    const monitoredTradeByPair: Map<string, Trade> = new Map(
      monitoredTrades.filter(({ index }) => index == 0).map((trade): [string, Trade] => [trade.pair, trade])
    );

    const allPairs = this.config.assetMappings.map((x) => x.asset);
    this.snapshotCnt += 1;
    log.debug(
      `Snapshot: cnt ${this.snapshotCnt}, blockedToOpen: ${JSON.stringify(Array.from(this.blockedToOpen))} myTrades: ${JSON.stringify(
        myTrades
      )}, monitoredTrades: ${JSON.stringify(monitoredTrades)}, assetStates: ${JSON.stringify(this.assetStates)}`
    );
    const effects: MarketOrderInitiated[] = allPairs
      .map((pair) => {
        const myTrade = myTradeByPair.get(pair);
        const monitoredTrade = monitoredTradeByPair.get(pair);
        let assetState = this.assetStates.get(pair);

        if (myTrade || monitoredTrade || assetState) {
          // update assetState first
          const myTradeDir: "buy" | "sell" = !myTrade ? undefined : myTrade?.buy ? "buy" : "sell";
          if (myTrade && assetState?.trade?.dir != myTradeDir) {
            const newAssetState = {
              status: "open" as any,
              trade: {
                pair: myTrade.pair,
                dir: myTradeDir,
                size: myTrade.positionSizeDai,
                leverage: myTrade.leverage,
                openPrice: myTrade.openPrice,
                openTs: assetState?.trade?.openTs ?? new Date(),
              },
            };
            this.assetStates.set(myTrade.pair, newAssetState);
            log.info(`Snapshot: ${pair}, overwriting ${JSON.stringify(assetState)} => ${JSON.stringify(newAssetState)}`);
            assetState = newAssetState;
          } else if (!myTrade) {
            this.assetStates.delete(pair);
          }
        }

        if (monitoredTrade && (assetState?.status ?? "idle") == "idle") {
          // missed open
          if (this.snapshotCnt == 1) this.blockedToOpen.add(pair);
          if (!this.blockedToOpen.has(pair)) {
            // console.log("##### 0.1 ", pair);
            return {
              orderId: -111,
              trader: this.config.monitoredTrader,
              pair,
              open: true,
            };
          }
        } else if (monitoredTrade && assetState?.status == "open") {
          const monitoredTradeDir: "buy" | "sell" = monitoredTrade.buy ? "buy" : "sell";
          if (assetState?.trade?.dir != monitoredTradeDir) {
            // have wrong dir, close
            if (this.snapshotCnt == 1) this.blockedToOpen.add(pair);
            return {
              orderId: -222,
              trader: this.config.monitoredTrader,
              pair,
              open: false,
            };
          }
        } else {
          this.blockedToOpen.delete(pair);
          if (!monitoredTrade && assetState?.status == "open")
            return {
              orderId: -333,
              trader: this.config.monitoredTrader,
              pair,
              open: false,
            };
        }
      })
      .filter((x) => x);
    if (effects.length == 0) log.debug(`Snapshot: Issuing no trades, blockedToOpen: ${JSON.stringify(Array.from(this.blockedToOpen))}`);
    else
      log.info(
        `Snapshot: Issuing trades: ${effects.map((x) => `${x.pair} => ${x.open ? "open" : "close"}`).join(", ")}, blockedToOpen: ${JSON.stringify(
          Array.from(this.blockedToOpen)
        )}`
      );
    await Promise.all(effects.map(async (x) => this.handleMonitoredEvent(x)));
  }

  async handleMonitoredEvent(event: MarketOrderInitiated) {
    const configAsset = this.config.assetMappings.find((x) => x.asset == event.pair);
    if (!configAsset) log.debug(`...Ignoring unsupported event pair ${event.pair}`);
    else
      return await this.mutex.runExclusive(async () => {
        let state = this.assetStates.get(event.pair);
        if (!state) {
          state = {
            status: "idle",
          };
          this.assetStates.set(event.pair, state);
        }

        switch (state.status) {
          case "idle":
            if (event.open) {
              log.info(`${state.status}-${event.pair}: Following monitored event ${JSON.stringify(event)}`);
              const monitoredTrades = await this.waitOpenTrades(event.pair, event.trader, true);
              if (monitoredTrades.length == 0)
                log.info(`${state.status}-${event.pair}: Not seeing any open trades for trader ${shortPubkey(event.trader)}, staying idle`);
              else {
                const firstTrade = monitoredTrades.find((x) => x.index == 0);
                log.info(`${state.status}-${event.pair}: Following monitored trade ${JSON.stringify(firstTrade)}`);
                const dir = firstTrade.buy ? "buy" : "sell";
                const [openPrice] = await this.gtrade.issueMarketTrade(firstTrade.pair, configAsset.cashAmount, configAsset.leverage, dir);
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
                    size: configAsset.cashAmount,
                    leverage: configAsset.leverage,
                    openPrice: openPrice,
                    openTs: now,
                  };
                  this.notifier?.publish(`${state.status}-${event.pair}: Opened ${dir} of ${configAsset.cashAmount} @ $${openPrice}`);
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
                this.assetStates.set(event.pair, { status: "idle" });
                this.notifier?.publish(
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
    for (var i = 0; i < MAX_WAIT_RETRIES; i++) {
      trades = await this.gtrade.getOpenTrades(pair, trader);
      log.info(`...${pair}::${shortPubkey(trader)}: got ${trades.length}, expectSome: ${expectSome}`);
      switch (trades.length) {
        case 0:
          if (expectSome) await sleep(WAIT_SLEEP_MS);
          else return trades;
          break;
        default:
          if (expectSome) return trades;
          else await sleep(WAIT_SLEEP_MS);
          break;
      }
    }
    return trades;
  }
}
