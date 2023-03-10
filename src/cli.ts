#!ts-node

// Usage: src/cli.ts publishNotification "test msg"

import * as cmdts from "cmd-ts";
import { loadConfig } from "./configuration";
import { log } from "./log";
import { Notifier } from "./notifications";
import { sleep } from "./utils";
import { GasPriceOracle } from "gas-price-oracle";
import { GTrade, MUMBAI_SPEC } from "./gtrade";

export const WALLET_PRIV_KEY = "ec03990c0814273acd86027a03fdf4c2da1eba2d70646f7bd493743c4d9f0f57";
export const WALLET_PUB_KEY = "0xcF56D6c5e292a472035810a8bd3ef41BBb645C01";

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

  const watchGasPrices = cmdts.command({
    name: "watchGasPrices",
    args: {},
    handler: async () => {
      const oracle = new GasPriceOracle({ chainId: 137 }); // Polygon
      setInterval(async () => {
        const gasPrice = await oracle.eip1559.estimateFees({
          maxFeePerGas: 20,
          maxPriorityFeePerGas: 3,
          baseFee: undefined,
        });
        log.info(`gasPrice: ${JSON.stringify(gasPrice)}`);
      }, 1000);
      await sleep(60_000); // needed for message to propagate
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
    args: {},
    handler: async () => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, MUMBAI_SPEC);
      log.info(`========== gTrade stats ==========
allowance:       ${await gtrade.getAllowance()}
balance:         ${await gtrade.getBalance()}
daiBalance:      ${await gtrade.getDaiBalance()}
openTradeCounts: ${[...(await gtrade.getOpenTradeCounts()).entries()].map(([k, v]) => `${k}:${v}`)}`);
    },
  });

  const getOpenTrades = cmdts.command({
    name: "getOpenTrades",
    args: {
      pair: cmdts.option({
        type: cmdts.string,
        long: "pair",
        defaultValue: () => "btc",
      }),
    },
    handler: async ({ pair }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, MUMBAI_SPEC);
      const trades = await gtrade.getOpenTrades(pair);
      log.info(`open trades:\n${trades.join("\n")}`);
    },
  });

  const approveAllowance = cmdts.command({
    name: "approveAllowance",
    args: {},
    handler: async () => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, MUMBAI_SPEC);
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
      pair: cmdts.option({
        type: cmdts.string,
        long: "pair",
        defaultValue: () => "btc",
      }),
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
      dir: cmdts.option({
        type: cmdts.string,
        long: "dir",
        defaultValue: () => "buy",
      }),
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
    },
    handler: async ({ orderIndex, pair, size, price, slippage, leverage, dir, takeProfit, stopLoss }) => {
      const config = loadConfig();
      console.log(`Issuing trade as ${config.wallet.address}`);
      const gtrade = new GTrade(config.wallet.privateKey, MUMBAI_SPEC);
      const res = await gtrade.issueTrade(pair, size, price, leverage, dir as "buy" | "sell", takeProfit, stopLoss, orderIndex, slippage);
      log.info(`issueTrade hash ${res.hash}`);
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
      pair: cmdts.option({
        type: cmdts.string,
        long: "pair",
        defaultValue: () => "btc",
      }),
    },
    handler: async ({ orderIndex, pair }) => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, MUMBAI_SPEC);
      const res = await gtrade.closeTrade(pair, orderIndex);
      log.info(`closeTrade hash ${res.hash}`);
    },
  });

  const cmd = cmdts.subcommands({
    name: "cmd",
    cmds: {
      publishNotification,
      watchGasPrices,
      showKeys,
      gTradeStats,
      getOpenTrades,
      approveAllowance,
      issueTrade,
      closeTrade,
    },
  });

  await cmdts.run(cmd, process.argv.slice(2));
}

main().then((_) => process.exit(0));
