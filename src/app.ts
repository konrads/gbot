#!ts-node

import { loadConfig } from "./configuration";
import { bumpRestartCount, schedule, sleep, toFixed } from "./utils";
import { startExpress } from "./webserver";
import { log } from "./log";
import { Orchestrator } from "./orchestrator";
import { Notifier } from "./notifications";
import { GTrade, ChainSpec } from "./gtrade";
import { getChainSpec } from "./gtrade/chainspec";

const INTERVAL_MS = 60 * 1 * 1000;

async function main() {
  const config = loadConfig();
  log.info(`Starting Gbot with config:
• traderChainSpec:    ${config.traderChainSpec}
• listenerChainSpec:  ${config.listenerChainSpec}
• webServerPort:      ${config.webServerPort} 
• assetMappings:      ${JSON.stringify(config.assetMappings)}
• mockParams:         ${config.mockParams ? JSON.stringify(config.mockParams) : "--"}
`);
  const traderChainSpec: ChainSpec = getChainSpec(config.traderChainSpec);
  const gtrader = new GTrade(config.wallet.privateKey, traderChainSpec);

  const notifier = new Notifier(config.notifications);
  const orchestrator = new Orchestrator(config, gtrader, notifier);

  const listenerChainSpec: ChainSpec = getChainSpec(config.listenerChainSpec ?? config.traderChainSpec);
  const glistener = new GTrade(config.wallet.privateKey, listenerChainSpec);

  const restartCnt = await bumpRestartCount();
  startExpress(config, orchestrator);

  const die = async (reason: string) => {
    log.info(`Shutting down due to ${reason}`);
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
  const allAssets = config.assetMappings.map((x) => x.asset);
  schedule(async () => {
    try {
      const myTrades = (await Promise.all(allAssets.map(async (p) => gtrader.getOpenTrades(p)))).flat();
      const monitoredTrades = (await Promise.all(allAssets.map(async (p) => gtrader.getOpenTrades(p, config.monitoredTrader)))).flat();
      await orchestrator.updateSnapshot(myTrades, monitoredTrades);
      await orchestrator.updateHealthCheck();
    } catch (e) {
      die(`Snapshot error ${e}`);
    }
  }, INTERVAL_MS);

  glistener.subscribeMarketOrderInitiated([config.monitoredTrader], async (event) => {
    const pair = listenerChainSpec.pairs.find((x) => x.index == event.pairIndex);
    if (pair) {
      event.pair = pair.pair;
      orchestrator.handleMonitoredEvent(event);
    } else log.debug(`Listener received unsupported event ${JSON.stringify(event)}`);
  });

  notifier.publish(`Gbot restart: ${restartCnt}`);
}

main();
