#!ts-node

import { loadConfig } from "./configuration";
import { bumpRestartCount, sleep } from "./utils";
import { startExpress } from "./webserver";
import { log } from "./log";
import { Orchestrator } from "./orchestrator";
import { Notifier } from "./notifications";
import { ChainSpec, getChainSpec, GTrade, GTRADE_PAIRS } from "./gtrade";

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
  // const notifier = new Notifier(config.notifications);
  const orchestrator = new Orchestrator(gtrader, config);

  const listenerChainSpec: ChainSpec = getChainSpec(config.listenerChainSpec ?? config.traderChainSpec);
  const glistener = new GTrade(config.wallet.privateKey, listenerChainSpec);
  glistener.subscribeMarketOrderInitiated([config.monitoredTrader], async (event) => {
    event.pair = GTRADE_PAIRS[event.pairIndex];
    orchestrator.handleMonitoredEvent(event);
  });

  const die = async (reason: string) => {
    log.info(`Shutting down due to ${reason}`);
    // notifier.publish(`Shutting down due to ${reason}`);
    // await trader.shutdown();
    process.exit(1);
  };

  const restartCnt = await bumpRestartCount();
  startExpress(config, orchestrator);

  process.on("SIGINT", async () => {
    await die("SIGINT");
  });
  process.on("SIGTERM", async () => {
    await die("SIGTERM");
  });

  // notifier.publish(`Gbot restart: ${restartCnt}`);
}

main();
