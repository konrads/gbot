#!ts-node

// Usage: src/cli.ts publishNotification "test msg"

import * as cmdts from "cmd-ts";
import { loadConfig } from "./configuration";
import { log } from "./log";
import { Notifier } from "./notifications";
import { sleep } from "./utils";
import { GTrade } from "./gtrade";
import { getChainSpec } from "./gtrade/chainspec";

export const WALLET_PRIV_KEY = "ec03990c0814273acd86027a03fdf4c2da1eba2d70646f7bd493743c4d9f0f57";
export const WALLET_PUB_KEY = "0xcF56D6c5e292a472035810a8bd3ef41BBb645C01";

const CHAIN = cmdts.option({
  type: cmdts.string,
  long: "chain",
  defaultValue: () => undefined,
});
const PAIR = cmdts.option({
  type: cmdts.string,
  long: "pair",
  defaultValue: () => "btc",
});
const SLEEP_MS = cmdts.option({
  type: cmdts.number,
  long: "sleepMs",
  defaultValue: () => 10 * 60 * 1000, // 10 mins
});
const DIR = cmdts.option({
  type: cmdts.string,
  long: "dir",
  defaultValue: () => "buy",
});
const TRADER = cmdts.option({
  type: cmdts.string,
  long: "trader",
  defaultValue: () => undefined,
});

async function main() {
  const publishNotification = cmdts.command({
    name: "publishNotification",
    args: {
      message: cmdts.positional({
        type: cmdts.string,
        displayName: "message",
      }),
    },
    handler: async ({ message }) => {
      const config = loadConfig();
      const notifier = new Notifier(config.notifications);
      notifier.publish(message);
      await sleep(1000); // needed for message to propagate
    },
  });

  const showKeys = cmdts.command({
    name: "showKeys",
    args: {},
    handler: async () => {
      const config = loadConfig();
      log.info(`privKey: ${config.wallet.privateKey}\npubKey:  ${config.wallet.address}`);
    },
  });

  const gTradeStats = cmdts.command({
    name: "gTradeStats",
    args: {
      chain: CHAIN,
    },
    handler: async ({ chain }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      log.info(`========== gTrade stats ==========
pubkey:          ${config.wallet.address}
monitoredPubkey: ${config.monitoredTrader}
allowance:       ${await gtrade.getAllowance()}
balance:         ${await gtrade.getBalance()}
daiBalance:      ${await gtrade.getDaiBalance()}
openTradeCounts: ${[...(await gtrade.getOpenTradeCounts()).entries()].map(([k, v]) => `${k}:${v}`)}`);
    },
  });

  const getOpenTrades = cmdts.command({
    name: "getOpenTrades",
    args: {
      pair: PAIR,
      chain: CHAIN,
      trader: TRADER,
    },
    handler: async ({ pair, chain, trader }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      const trades = await gtrade.getOpenTrades(pair, trader);
      log.info(`open trades:\n${trades.map((x) => JSON.stringify(x)).join("\n")}`);
    },
  });

  const getOpenTradesInfo = cmdts.command({
    name: "getOpenTrades",
    args: {
      pair: PAIR,
      chain: CHAIN,
      trader: TRADER,
    },
    handler: async ({ pair, chain, trader }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      const trades = await gtrade.getOpenTradesInfo(pair, trader);
      log.info(`open trades:\n${trades.map((x) => JSON.stringify(x)).join("\n")}`);
    },
  });

  const approveAllowance = cmdts.command({
    name: "approveAllowance",
    args: {
      chain: CHAIN,
    },
    handler: async ({ chain }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      const res = await gtrade.approveAllowance();
      log.info(`approveAllowance hash ${res.hash}`);
    },
  });

  const issueTrade = cmdts.command({
    name: "issueTrade",
    args: {
      orderIndex: cmdts.option({
        type: cmdts.number,
        long: "orderIndex",
        defaultValue: () => 0,
      }),
      pair: PAIR,
      size: cmdts.option({
        type: cmdts.number,
        long: "size",
      }),
      price: cmdts.option({
        type: cmdts.number,
        long: "price",
      }),
      slippage: cmdts.option({
        type: cmdts.number,
        long: "slippage",
        defaultValue: () => 0,
      }),
      leverage: cmdts.option({
        type: cmdts.number,
        long: "leverage",
        defaultValue: () => 1,
      }),
      dir: DIR,
      takeProfit: cmdts.option({
        type: cmdts.number,
        long: "takeProfit",
        defaultValue: () => undefined,
      }),
      stopLoss: cmdts.option({
        type: cmdts.number,
        long: "stopLoss",
        defaultValue: () => undefined,
      }),
      chain: CHAIN,
    },
    handler: async ({ orderIndex, pair, size, price, slippage, leverage, dir, takeProfit, stopLoss, chain }) => {
      const config = loadConfig();
      console.log(`Issuing trade as ${config.wallet.address}`);
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      const receipt = await gtrade.issueTrade(pair, size, price, leverage, dir as "buy" | "sell", takeProfit, stopLoss, orderIndex, slippage);
      log.info(`issueTrade status ${receipt.status}, hash ${receipt.transactionHash}`);
    },
  });

  const issueMarketTrade = cmdts.command({
    name: "issueMarketTrade",
    args: {
      orderIndex: cmdts.option({
        type: cmdts.number,
        long: "orderIndex",
        defaultValue: () => 0,
      }),
      pair: PAIR,
      size: cmdts.option({
        type: cmdts.number,
        long: "size",
      }),
      slippage: cmdts.option({
        type: cmdts.number,
        long: "slippage",
        defaultValue: () => 0,
      }),
      leverage: cmdts.option({
        type: cmdts.number,
        long: "leverage",
        defaultValue: () => 1,
      }),
      dir: DIR,
      takeProfit: cmdts.option({
        type: cmdts.number,
        long: "takeProfit",
        defaultValue: () => undefined,
      }),
      stopLoss: cmdts.option({
        type: cmdts.number,
        long: "stopLoss",
        defaultValue: () => undefined,
      }),
      chain: CHAIN,
    },
    handler: async ({ orderIndex, pair, size, slippage, leverage, dir, takeProfit, stopLoss, chain }) => {
      const config = loadConfig();
      console.log(`Issuing trade as ${config.wallet.address}`);
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      const [openPrice, receipt] = await gtrade.issueMarketTrade(pair, size, leverage, dir as "buy" | "sell", takeProfit, stopLoss, orderIndex, slippage);
      log.info(`issueMarketTrade status ${receipt.status}, hash ${receipt.transactionHash}, openPrice ${openPrice}`);
    },
  });

  const closeTrade = cmdts.command({
    name: "closeTrade",
    args: {
      orderIndex: cmdts.option({
        type: cmdts.number,
        long: "orderIndex",
        defaultValue: () => 0,
      }),
      pair: PAIR,
      chain: CHAIN,
    },
    handler: async ({ orderIndex, pair, chain }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      const [closePrice, receipt] = await gtrade.closeTrade(pair, orderIndex);
      log.info(`closeTrade status ${receipt.status}, hash ${receipt.transactionHash}, closePrice ${closePrice}`);
    },
  });

  const closeAllTrades = cmdts.command({
    name: "closeAllTrades",
    args: {
      chain: CHAIN,
    },
    handler: async ({ chain }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      const closedTrades = await gtrade.closeAllTrades();
      log.info(`send close to trades: ${JSON.stringify([...closedTrades.entries()])}`);
    },
  });

  const subscribeTradingEvents = cmdts.command({
    name: "subscribeTradingEvents",
    args: {
      addresses: cmdts.option({
        type: cmdts.string,
        long: "addresses",
        defaultValue: () => null,
      }),
      sleepMs: SLEEP_MS,
      chain: CHAIN,
    },
    handler: async ({ addresses, sleepMs, chain }) => {
      const config = loadConfig();
      const addressez = addresses ? addresses.split(",").map((x) => x.trim()) : [config.wallet.address, config.monitoredTrader];
      log.info(`Monitoring trade events on pubkeys: ${addressez}`);
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      await gtrade.subscribeMarketOrderInitiated(addressez, async (event) => console.log(`${new Date()}::event received ${JSON.stringify(event)}`));
      await sleep(sleepMs);
    },
  });

  const subscribeAggregatorEvents = cmdts.command({
    name: "subscribeAggregatorEvents",
    args: {
      sleepMs: SLEEP_MS,
      chain: CHAIN,
    },
    handler: async ({ sleepMs, chain }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      await gtrade.subscribeAggregatorEvents(async (event) => console.log(`${new Date()}:: event received ${JSON.stringify(event)}`));
      await sleep(sleepMs);
    },
  });

  const getPrice = cmdts.command({
    name: "getPrice",
    args: {
      chain: CHAIN,
      pair: PAIR,
    },
    handler: async ({ chain, pair }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      const price = await gtrade.getOraclePrice(pair);
      console.log(`${pair} = $${price}`);
    },
  });

  const perpetualOpenClose = cmdts.command({
    name: "perpetualOpenClose",
    args: {
      chain: CHAIN,
      dir: DIR,
      pair: PAIR,
    },
    handler: async ({ chain, dir, pair }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, getChainSpec((chain as any) ?? config.listenerChainSpec));
      const size = 100;
      const leverage = 20;
      const stopLoss = dir == "buy" ? 0 : 100_000;
      const takeProfit = dir == "buy" ? 100_000 : 0;
      const MAX_TRADES = 100;
      const MAX_WAITS = 10;
      for (var i = 0; i < MAX_TRADES; i++) {
        const oraclePrice = await gtrade.getOraclePrice(pair);
        log.info(`${i}. Opening trade on ${pair}, oraclePrice: ${oraclePrice}, size: ${size}, dir: ${dir}, tp: ${takeProfit}, sl: ${stopLoss}`);
        await gtrade.issueMarketTrade(pair, size, leverage, dir as any, takeProfit, stopLoss);

        // validate 1 trade exists
        for (var j = 0; j < MAX_WAITS; j++) {
          const tradeCnt = await gtrade.getOpenTradeCount(pair);
          log.info(`  ${pair} trade count: ${tradeCnt}`);
          if (tradeCnt == 1) break;
          else {
            log.info(`  ...unexpected tradeCnt, waiting 1s`);
            await sleep(1000);
          }
        }

        log.info(`${i}. Closing trade on ${pair}`);
        await gtrade.closeTrade(pair, 0);

        // validate 0 trade exists
        for (var j = 0; j < MAX_WAITS; j++) {
          const tradeCnt = await gtrade.getOpenTradeCount(pair);
          log.info(`  ${pair} trade count: ${tradeCnt}`);
          if (tradeCnt == 0) break;
          else {
            log.info(`  ...unexpected tradeCnt, waiting 1s`);
            await sleep(1000);
          }
        }
      }
    },
  });

  const cmd = cmdts.subcommands({
    name: "cmd",
    cmds: {
      publishNotification,
      showKeys,
      gTradeStats,
      getOpenTrades,
      getOpenTradesInfo,
      approveAllowance,
      issueTrade,
      issueMarketTrade,
      closeTrade,
      closeAllTrades,
      subscribeTradingEvents,
      subscribeAggregatorEvents,
      getPrice,
      perpetualOpenClose,
    },
  });

  await cmdts.run(cmd, process.argv.slice(2));
}

main().then((_) => process.exit(0));
