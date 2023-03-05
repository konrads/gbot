#!ts-node

import { loadConfig } from "./configuration";
import { bumpRestartCount, schedule, sleep } from "./utils";
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
• network:                   ${config.network}
• endpoint:                  ${config.endpoint}
• lockingIntervalMs:         ${config.lockingIntervalMs}
• webServerPort:             ${config.webServerPort} 
• symbolMappings:            ${JSON.stringify(config.symbolMappings)}
• mockParams:                ${config.mockParams ? JSON.stringify(config.mockParams) : "--"}
`);
  const assets = config.symbolMappings.map(({ symbol: gainsTicker }) => gainsTicker);
  const state = new State(assets);
  const realTrader = new Trader(config.symbolMappings);
  let mockExchange: MockExchange;
  if (config.mockParams)
    mockExchange = new MockExchange(
      config.wallet.address,
      config.monitoredTrader,
      config.mockParams,
      config.symbolMappings.map((x) => x.symbol)
    );
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

  // stale price check
  schedule(async () => {
    const now = Date.now();
    const assetPriceAge = assets.map((asset): [string, number, number] => {
      const priceAndTs = state.getPrice(asset);
      return [asset, priceAndTs?.price, now - priceAndTs?.ts.getTime()];
    });
    const stale = assetPriceAge.filter(([_1, _2, age]) => age > config.markPriceStaleIntervalMs);
    if (stale.length > 0)
      await die(
        `stale mark prices
${stale.map(([asset, ts, age]) => `- ${asset}, lastUpdated: ${ts.toLocaleString()}, age: ${age}ms`).join(`\n`)}`
      );
    else log.debug(`stale mark price check success: ${assetPriceAge.map(([asset, _, age]) => JSON.stringify({ asset, age }))}`);
  }, config.markPriceStaleIntervalMs);

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
