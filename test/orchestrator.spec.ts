import * as assert from "assert";
import { AssetState, NotifierEvent, calcEvents } from "../src/orchestrator";
import { Trade } from "../src/gtrade";
import { AssetMapping } from "../src/configuration";

const t0 = new Date();
const assetMappings: AssetMapping[] = [{ asset: "btc", cashAmount: 1000, leverage: 3, trailingStoploss: 0.2 }];
const tag = "xxx";
const tradeTemplate = {
  trader: "wolf",
  pair: "btc",
  index: 0,
  initialPosToken: 1000,
  positionSizeDai: 1000,
  leverage: 3,
  tp: 100_000,
  sl: 0,
};

describe("orchestrator", function () {
  it("calcEvents-initial-blocked", function () {
    const monitoredTrades: Trade[] = [{ ...tradeTemplate, openPrice: 25_000, buy: true }];
    const myTrades: Trade[] = [];
    const prices: Map<string, { price: number; ts: Date }> = new Map([["btc", { price: 30_000, ts: t0 }]]);
    const blockedToOpen: Set<string> = new Set();
    const assetStates: Map<string, AssetState> = new Map([["btc", {}]]);

    const events = calcEvents(monitoredTrades, myTrades, prices, blockedToOpen, assetStates, assetMappings, t0, tag, true);
    assert.strictEqual(1, events.length);
    assert.ok((events[0] as NotifierEvent).notifierMsg.includes("blocking due to initial monitoredTrade"));
    assert.deepEqual(new Set(["btc"]), blockedToOpen);
  });

  it("calcEvents-trailing-stoploss-long", function () {
    const monitoredTrades: Trade[] = [{ ...tradeTemplate, openPrice: 20_000, buy: true }];
    const myTrades: Trade[] = [{ ...tradeTemplate, openPrice: 20_000, buy: true }];
    const prices: Map<string, { price: number; ts: Date }> = new Map([["btc", { price: 20_000, ts: t0 }]]);
    const blockedToOpen: Set<string> = new Set();
    const assetStates: Map<string, AssetState> = new Map([
      ["btc", { currTrade: { pair: "btc", dir: "buy", boundaryPrice: 22_000, size: 1000, leverage: 3, openPrice: 25_000, openTs: t0 } }],
    ]);

    let events = calcEvents(monitoredTrades, myTrades, prices, blockedToOpen, assetStates, assetMappings, t0, tag, false);
    assert.strictEqual(0, events.length);

    // raise the boundary to 30k
    prices.set("btc", { price: 30_000, ts: t0 });
    events = calcEvents(monitoredTrades, myTrades, prices, blockedToOpen, assetStates, assetMappings, t0, tag, false);
    assert.strictEqual(0, events.length);

    // lower the price to 20k - trigger stoploss
    prices.set("btc", { price: 20_000, ts: t0 });
    events = calcEvents(monitoredTrades, myTrades, prices, blockedToOpen, assetStates, assetMappings, t0, tag, false);
    assert.strictEqual(2, events.length);
    assert.strictEqual((events[0] as NotifierEvent).notifierMsg, "btc-open-xxx: blocked");
    assert.deepEqual(events[1], {
      msgId: "btc-open-xxx",
      open: false,
      oraclePrice: 20_000,
      pair: "btc",
      stoploss: true,
    });
  });

  it("calcEvents-trailing-stoploss-short", function () {
    const monitoredTrades: Trade[] = [{ ...tradeTemplate, openPrice: 20_000, buy: false }];
    const myTrades: Trade[] = [{ ...tradeTemplate, openPrice: 20_000, buy: false }];
    const prices: Map<string, { price: number; ts: Date }> = new Map([["btc", { price: 20_000, ts: t0 }]]);
    const blockedToOpen: Set<string> = new Set();
    const assetStates: Map<string, AssetState> = new Map([
      ["btc", { currTrade: { pair: "btc", dir: "buy", boundaryPrice: 22_000, size: 1000, leverage: 3, openPrice: 25_000, openTs: t0 } }],
    ]);

    let events = calcEvents(monitoredTrades, myTrades, prices, blockedToOpen, assetStates, assetMappings, t0, tag, false);
    assert.strictEqual(0, events.length);

    // raise the price to 20k - trigger stoploss
    prices.set("btc", { price: 50_000, ts: t0 });
    events = calcEvents(monitoredTrades, myTrades, prices, blockedToOpen, assetStates, assetMappings, t0, tag, false);
    assert.strictEqual(2, events.length);
    assert.strictEqual((events[0] as NotifierEvent).notifierMsg, "btc-open-xxx: blocked");
    assert.deepEqual(events[1], {
      msgId: "btc-open-xxx",
      open: false,
      oraclePrice: 50_000,
      pair: "btc",
      stoploss: true,
    });
  });
});
