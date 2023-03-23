import express from "express";
import hbs from "hbs";
import { Config } from "./configuration";
import { log } from "./log";
import { toFixed } from "./utils";
import { Orchestrator } from "./orchestrator";

export function startExpress(config: Config, orchestrator: Orchestrator) {
  hbs.handlebars.registerHelper("cash", function (amount: number) {
    return amount ? `$${toFixed(amount, 2)}` : "";
  });
  hbs.handlebars.registerHelper("base", function (amount: number) {
    return amount ? toFixed(amount, 5) : "";
  });

  const expressApp = express();
  expressApp.use(express.json());
  expressApp.set("view engine", "hbs");

  expressApp.get("/dashboard", (req, res) => {
    const myClosedTrades = orchestrator.myClosedTrades;
    const pnl = myClosedTrades
      .map((x) => ((x.size * x.leverage * (x.closePrice - x.openPrice)) / x.openPrice) * (x.dir == "buy" ? 1 : -1))
      .reduce((x, y) => x + y, 0);

    const ctx = {
      now: new Date().toLocaleString(),
      refresh: req.query.refresh ?? 10,
      traderChainSpec: config.traderChainSpec,
      listenerChainSpec: config.listenerChainSpec,
      myPubkey: config.wallet.address,
      monitoredPubkey: config.monitoredTrader,
      pnl,

      assets: [...orchestrator.assetPrices.entries()].map(([asset, { price, ts }]) => {
        return {
          asset,
          price: toFixed(price, 2),
          ts: ts.toLocaleString(),
        };
      }),
      trades: myClosedTrades.map((x) => {
        return {
          ts: x.openTs.toLocaleString(),
          trade: `${x.pair}: ${x.dir} ${x.size} @ ${toFixed(x.openPrice, 2)}->${toFixed(x.closePrice, 2)}`,
          pnl: ((x.size * x.leverage * (x.closePrice - x.openPrice)) / x.openPrice) * (x.dir == "buy" ? 1 : -1),
        };
      }),
    };
    res.render("dashboard", ctx);
  });

  expressApp.listen(config.webServerPort, () => log.info(`Express server started at port ${config.webServerPort}`));
}
