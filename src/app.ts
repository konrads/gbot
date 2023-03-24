#!ts-node

import { loadConfig } from "./configuration";
import { bumpRestartCount, sleep } from "./utils";
import { startExpress } from "./webserver";
import { log } from "./log";
import { Orchestrator } from "./orchestrator";
import { Notifier } from "./notifications";
import { ChainSpec, getChainSpec, GTrade } from "./gtrade";

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

  if (config.closeTradesAtStart) {
    const tradesClosed = await gtrader.closeAllTrades();
    if (tradesClosed.size > 0) log.info(`Bootstrap: closed trades ${[...tradesClosed.entries()].map(([pair, cnt]) => `${pair}:${cnt}`).join(", ")}`);
    else log.info(`Bootstrap: no trades to close`);
  }

  const notifier = new Notifier(config.notifications);
  const orchestrator = new Orchestrator(config, gtrader, notifier);

  const listenerChainSpec: ChainSpec = getChainSpec(config.listenerChainSpec ?? config.traderChainSpec);
  const glistener = new GTrade(config.wallet.privateKey, listenerChainSpec);
  glistener.subscribeMarketOrderInitiated([config.monitoredTrader], async (event) => {
    event.pair = listenerChainSpec.pairs.find((x) => x.index == event.pairIndex)?.pair;
    orchestrator.handleMonitoredEvent(event);
  });

  const die = async (reason: string) => {
    log.info(`Shutting down due to ${reason}`);
    await notifier.publish(`Shutting down due to ${reason}`);
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

  notifier.publish(`Gbot restart: ${restartCnt}`);
}

main();
