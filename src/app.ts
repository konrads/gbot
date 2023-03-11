#!ts-node

import { loadConfig } from "./configuration";
import { bumpRestartCount, sleep } from "./utils";
import { startExpress } from "./webserver";
import { log } from "./log";
import { Orchestrator } from "./orchestrator";
import { Notifier } from "./notifications";
import { State } from "./state";
import { Trader } from "./trader";
import { MockExchange, MockTrader } from "./mocks";

async function main() {
  const config = loadConfig();
  log.info(`Starting Gbot with config:
• network:        ${config.network}
• endpoint:       ${config.endpoint}
• webServerPort:  ${config.webServerPort} 
• assetMappings:  ${JSON.stringify(config.assetMappings)}
• mockParams:     ${config.mockParams ? JSON.stringify(config.mockParams) : "--"}
`);
  const assets = config.assetMappings.map(({ asset }) => asset);
  const state = new State(assets);
  const realTrader = new Trader(config.assetMappings);
  let mockExchange: MockExchange;
  if (config.mockParams) mockExchange = new MockExchange(config.wallet.address, config.monitoredTrader, config.mockParams, config.assetMappings);
  const trader = config.mockParams ? new MockTrader(realTrader, mockExchange) : realTrader;
  const notifier = new Notifier(config.notifications);
  const orchestrator = new Orchestrator(config, state, trader, notifier);
  await orchestrator.initialize();
  if (mockExchange) {
    await sleep(2000); // allow price warmup
    mockExchange.initialize((ownerPubkey: string, data) => orchestrator.handleEvent(ownerPubkey, data));
  }

  const die = async (reason: string) => {
    log.info(`Shutting down due to ${reason}`);
    notifier.publish(`Shutting down due to ${reason}`);
    await trader.shutdown();
    process.exit(1);
  };

  const restartCnt = await bumpRestartCount();
  startExpress(config, state);

  process.on("SIGINT", async () => {
    await die("SIGINT");
  });
  process.on("SIGTERM", async () => {
    await die("SIGTERM");
  });

  notifier.publish(`Gbot restart: ${restartCnt}`);
}

main();
