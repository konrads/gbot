import express from "express";
import hbs from "hbs";
import { Config } from "./configuration";
import { log } from "./log";
import { State } from "./state";
import { toFixed } from "./utils";

export function startExpress(config: Config, state: State) {
  hbs.handlebars.registerHelper("currency", function (cash: number) {
    return `$${toFixed(cash, 2)}`;
  });
  hbs.handlebars.registerHelper("baseAmount", function (cash: number) {
    return `${toFixed(cash, 5)}`;
  });

  const expressApp = express();
  expressApp.use(express.json());
  expressApp.set("view engine", "hbs");

  expressApp.get("/dashboard", (req, res) => {
    const ctx = {
      now: new Date().toLocaleString(),
      refresh: req.query.refresh ?? 10,
      network: config.network,

      assets: state.assets.map((asset) => {
        const price = state.getPrice(asset);
        const positionBase = state.getPosition(asset);
        const positionCash =
          positionBase && price ? positionBase * price.price : undefined;
        return {
          asset,
          price: price?.price,
          priceTs: price?.ts.toLocaleString(),
          positionBase,
          positionCash,
        };
      }),
      orders: state.orders.map(([ts, order]): [string, string] => [
        new Date(ts).toLocaleString(),
        JSON.stringify(order),
      ]),
    };
    res.render("dashboard", ctx);
  });

  expressApp.listen(config.webServerPort, () =>
    log.info(`Express server started at port ${config.webServerPort}`)
  );
}
