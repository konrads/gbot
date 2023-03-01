#!ts-node

// Usage: src/cli.ts watchPrices
//        src/cli.ts publishNotification "test msg"

import * as cmdts from "cmd-ts";
import { loadConfig } from "./configuration";
import { Trader } from "./trader";
import { log } from "./log";
import { Notifier } from "./notifications";
import { sleep } from "./utils";
import { GasPriceOracle } from "gas-price-oracle";
import { GTrade, MUMBAI_SPEC } from "./gtrade";

export const WALLET_PRIV_KEY = "ec03990c0814273acd86027a03fdf4c2da1eba2d70646f7bd493743c4d9f0f57";
export const WALLET_PUB_KEY = "0xcF56D6c5e292a472035810a8bd3ef41BBb645C01";

async function main() {
  const watchPrices = cmdts.command({
    name: "watchPrices",
    args: {
      waitSec: cmdts.option({
        type: cmdts.number,
        long: "waitSec",
        short: "w",
        defaultValue: () => 60,
      }),
    },
    handler: async ({ waitSec }) => {
      const config = loadConfig();
      const trader = new Trader(config.assets, config.refExchange);
      trader.subscribeMarkPrices((asset: string, price: number) => {
        log.info(`${asset}: ${price}`);
      });
      await sleep(waitSec * 1000);
    },
  });

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
        console.log(`gasPrice: ${JSON.stringify(gasPrice)}`);
      }, 1000);
      await sleep(60_000); // needed for message to propagate
    },
  });

  const showKeys = cmdts.command({
    name: "showKeys",
    args: {},
    handler: async () => {
      const config = loadConfig();
      console.log(`privKey: ${config.wallet.privateKey}\npubKey:  ${config.wallet.address}`);
    },
  });

  const gTradeStats = cmdts.command({
    name: "gTradeStats",
    args: {},
    handler: async () => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, MUMBAI_SPEC);
      console.log(`========== gTrade stats ==========
allowance:       ${await gtrade.getAllowance()}
balance:         ${await gtrade.getBalance()}
daiBalance:      ${await gtrade.getDaiBalance()}
openTradeCounts: ${[...(await gtrade.getOpenTradeCounts()).entries()].map(([k, v]) => `${k}:${v}`)}
`);
    },
  });

  const approveAllowance = cmdts.command({
    name: "approveAllowance",
    args: {},
    handler: async () => {
      const config = loadConfig();
      const gtrade = new GTrade(config.wallet.privateKey, MUMBAI_SPEC);
      const res = await gtrade.approveAllowance();
      console.log(`approveAllowance response ${JSON.stringify(res)}`);
    },
  });

  const cmd = cmdts.subcommands({
    name: "cmd",
    cmds: {
      watchPrices,
      publishNotification,
      watchGasPrices,
      showKeys,
      gTradeStats,
      approveAllowance,
    },
  });

  await cmdts.run(cmd, process.argv.slice(2));
}

main().then((_) => process.exit(0));
