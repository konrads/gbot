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
        return {
          asset,
          price: toFixed(price?.price, 2),
          priceTs: price?.ts.toLocaleString(),
          amount: state.openTrades.get(asset)?.amount,
        };
      }),
      myTrades: state.myTrades.map(([ts, trade]) => {
        return {
          ts: new Date(ts).toLocaleString(),
          trade: `${trade.asset}: ${trade.dir} ${trade.amount} @ ${toFixed(trade.openPrice, 2)}->${toFixed(trade.closePrice, 2)}: status: ${trade.status}, ids: ${trade.tradeId}/${trade.clientTradeId}`,
        };
      }),
      monitoredTrades: state.monitoredTrades.map(([ts, trade]) => {
        return {
          ts: new Date(ts).toLocaleString(),
          trade: `${trade.asset}: ${trade.dir} ${trade.amount} @ ${toFixed(trade.openPrice, 2)}->${toFixed(trade.closePrice, 2)}: status: ${trade.status}, ids: ${trade.tradeId}/${trade.clientTradeId}`,
        };
      }),
    };
    res.render("dashboard", ctx);
  });

  expressApp.listen(config.webServerPort, () => log.info(`Express server started at port ${config.webServerPort}`));
}
