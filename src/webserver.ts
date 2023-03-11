import express from "express";
import hbs from "hbs";
import { Config } from "./configuration";
import { log } from "./log";
import { State } from "./state";
import { toFixed } from "./utils";

export function startExpress(config: Config, state: State) {
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
    const ctx = {
      now: new Date().toLocaleString(),
      refresh: req.query.refresh ?? 10,
      network: config.network,
      myPnl: state.myPnl,
      monitoredPnl: state.monitoredPnl,

      assets: state.assets.map((asset) => {
        const price = state.getPrice(asset);
        const positionBase = state.openTrades.get(asset).amount;
        const positionCash = positionBase && price ? positionBase * price.price : undefined;
        return {
          asset,
          price: price?.price,
          priceTs: price?.ts.toLocaleString(),
          positionBase,
          positionCash,
        };
      }),
      myTrades: state.myTrades.map(([ts, trade]) => {
        return {
          ts: new Date(ts).toLocaleString(),
          order: `${trade.asset}: ${trade.dir} ${trade.amount} @ ${trade.openPrice}: ${trade.status}, ${trade.clientTradeId}`,
        };
      }),
      monitoredTrades: state.monitoredTrades.map(([ts, trade]) => {
        return {
          ts: new Date(ts).toLocaleString(),
          order: `${trade.asset}: ${trade.dir} ${trade.amount} @ ${trade.openPrice}: ${trade.status}, ${trade.clientTradeId}`,
        };
      }),
    };
    res.render("dashboard", ctx);
  });

  expressApp.listen(config.webServerPort, () => log.info(`Express server started at port ${config.webServerPort}`));
}
