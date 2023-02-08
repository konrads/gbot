#!ts-node

// Usage: src/cli.ts watchPrices
//        src/cli.ts publishNotification "test msg"

import * as cmdts from "cmd-ts";
import { loadConfig } from "./configuration";
import { Trader } from "./trader";
import { log } from "./log";
import { Notifier } from "./notifications";
import { sleep } from "./utils";

async function main() {
  const watchPrices = cmdts.command({
    name: "watchPrices",
    args: {
      waitSec: cmdts.option({
        type: cmdts.number,
        long: "waitSec",
        short: "w",
        defaultValue: () => 60, // 1m
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

  // setup and run
  const cmd = cmdts.subcommands({
    name: "cmd",
    cmds: {
      watchPrices,
      publishNotification,
    },
  });

  await cmdts.run(cmd, process.argv.slice(2));
}

// FIXME: not auto-exiting, unsure what makes it hang around.
main().then((_) => process.exit(0));
