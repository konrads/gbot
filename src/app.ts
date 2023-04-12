#!ts-node

import { loadConfig } from "./configuration";
import { bumpRestartCount, schedule, sleep, translateError } from "./utils";
import { startExpress } from "./webserver";
import { log } from "./log";
import { Orchestrator } from "./orchestrator";
import { Notifier } from "./notifications";
import { GTrade, ChainSpec } from "./gtrade";
import { getChainSpec } from "./gtrade/chainspec";

const INTERVAL_MS = 30_000;
const WS_UPDATE_DELAY_MS = 5_000;

async function main() {
  const config = loadConfig();
  log.info(`Starting Gbot with config:
• myWallet:           ${config.wallet.address}
• monitoredTrader:    ${config.monitoredTrader}
• traderChainSpec:    ${config.traderChainSpec}
• listenerChainSpec:  ${config.listenerChainSpec}
• webServerPort:      ${config.webServerPort} 
• assetMappings:      ${JSON.stringify(config.assetMappings)}
`);
  const traderChainSpec: ChainSpec = getChainSpec(config.traderChainSpec);
  const gtrader = new GTrade(config.wallet.privateKey, traderChainSpec);
  const listenerChainSpec: ChainSpec = getChainSpec(config.listenerChainSpec ?? config.traderChainSpec);
  const glistener = new GTrade(config.wallet.privateKey, listenerChainSpec);
  const notifier = new Notifier(config.notifications);
  const orchestrator = new Orchestrator(config, gtrader, notifier);

  const restartCnt = await bumpRestartCount();
  startExpress(config, orchestrator);

  const die = async (reason: string) => {
    await notifier.publish(`Shutting down due to ${reason}`);
    process.exit(1);
  };

  process.on("SIGINT", async () => {
    await die("SIGINT");
  });
  process.on("SIGTERM", async () => {
    await die("SIGTERM");
  });

  // schedule snapshot & health check update
  const allPairs = config.assetMappings.map((x) => x.asset);
  schedule(async () => {
    try {
      log.debug(`Schedule triggered ${orchestrator.snapshotCnt}`);
      const monitoredTrades = (await Promise.all(allPairs.map(async (pair) => await glistener.getOpenTrades(pair, config.monitoredTrader)))).flat();
      await orchestrator.updateSnapshot(monitoredTrades);
      await orchestrator.updateHealthCheck();
    } catch (e) {
      die(`snapshot error ${translateError(e.stack)}`);
    }
  }, INTERVAL_MS);

  // re-update snapshot on any WS event
  // as there's no way to map event's orderIds to trade's index - trigger updateSnapshot on any relevant WS update
  glistener.subscribeMarketOrderInitiated([config.monitoredTrader], async (event) => {
    const pair = listenerChainSpec.pairs.find((x) => x.index == event.pairIndex);
    if (pair) {
      // sleeping before update as often trades appear late
      log.debug(`WS event triggered ${JSON.stringify(event)}, will update after ${WS_UPDATE_DELAY_MS}ms`);
      await sleep(WS_UPDATE_DELAY_MS);
      const monitoredTrades = (await Promise.all(allPairs.map(async (pair) => await glistener.getOpenTrades(pair, config.monitoredTrader)))).flat();
      await orchestrator.updateSnapshot(monitoredTrades);
    } else log.debug(`Listener received unsupported event ${JSON.stringify(event)}`);
  });

  notifier.publish(`Gbot restart: ${restartCnt}`);
}

main();
