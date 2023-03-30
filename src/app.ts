#!ts-node

import { loadConfig } from "./configuration";
import { bumpRestartCount, schedule, sleep, toFixed } from "./utils";
import { startExpress } from "./webserver";
import { log } from "./log";
import { Orchestrator } from "./orchestrator";
import { Notifier } from "./notifications";
import { GTrade, ChainSpec } from "./gtrade";
import { getChainSpec } from "./gtrade/chainspec";

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
    log.info(`Bootstrap: closeTradesAtStart requested...`);
    const tradesClosed = await gtrader.closeAllTrades();
    if (tradesClosed.size > 0) log.info(`Bootstrap: closed trades ${[...tradesClosed.entries()].map(([pair, cnt]) => `${pair}:${cnt}`).join(", ")}`);
    else log.info(`Bootstrap: no trades to close`);
  }

  const notifier = new Notifier(config.notifications);
  const orchestrator = new Orchestrator(config, gtrader, notifier);

  const listenerChainSpec: ChainSpec = getChainSpec(config.listenerChainSpec ?? config.traderChainSpec);
  const glistener = new GTrade(config.wallet.privateKey, listenerChainSpec);

  schedule(async () => {
    log.info(`health check start`);
    log.info(
      `health check eth/matic: ${toFixed(await gtrader.getBalance(), 4)} dai: ${toFixed(await gtrader.getDaiBalance(), 2)} openTrades: ${[
        ...(await gtrader.getOpenTradeCounts()).entries(),
      ].map(([k, v]) => `${k}:${v}`)}`
    );
  }, 60 * 1 * 1000);

  glistener.subscribeMarketOrderInitiated([config.monitoredTrader], async (event) => {
    const pair = listenerChainSpec.pairs.find((x) => x.index == event.pairIndex);
    if (pair) {
      event.pair = pair.pair;
      orchestrator.handleMonitoredEvent(event);
    } else log.debug(`Listener received unsupported event ${JSON.stringify(event)}`);
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
