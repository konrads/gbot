import * as assert from "assert";
import { Config } from "../src/configuration";
import { State } from "../src/state";
import { Orchestrator } from "../src/orchestrator";
import { Notifier } from "../src/notifications";
import { Trade, TradeId, Address } from "../src/types";
import { Wallet } from "ethers";

const wallet = new Wallet(Wallet.createRandom().privateKey);

const monitoredTrader = "monitored-trader";

const bogusTrader = "bogus-trader";

async function setup(...trades: { issuer: Address; trade: Trade }[]): Promise<{ state: State; orchestrator: Orchestrator; events: any[] }> {
  const config: Config = {
    network: "devnet",
    endpoint: "endpoint",
    webServerPort: 8085,
    notifications: undefined,
    assetMappings: [
      {
        asset: "BTC",
        cashAmount: 100,
        leverage: 10,
      },
      {
        asset: "ETH",
        cashAmount: 100,
        leverage: 10,
      },
      {
        asset: "SOL",
        cashAmount: 100,
        leverage: 10,
      },
    ],
    monitoredTrader,
    wallet,
  };

  class MockTrader {
    tradeEvents: any[] = [];

    async createTrade(trade: Trade): Promise<void> {
      this.tradeEvents.push({ event: "createTrade", trade });
    }

    async cancelTrade(clientTradeId: TradeId): Promise<void> {
      this.tradeEvents.push({ event: "cancelTrade", clientTradeId });
    }

    async closeTrade(clientTradeId: TradeId): Promise<void> {
      this.tradeEvents.push({ event: "closeTrade", clientTradeId });
    }

    async subscribeEvents(callback: (address: Address, data: any) => Promise<void>): Promise<void> {}

    async shutdown() {}
  }

  let idCnt = 0;
  const assets = config.assetMappings.map(({ asset }) => asset);
  const state: State = new State(assets);
  const trader = new MockTrader();
  const notifier: Notifier = new Notifier(config.notifications!);
  const orchestrator = new Orchestrator(config, state, trader, notifier, () => idCnt++);

  for (var { issuer, trade } of trades) await orchestrator.handleEvent(issuer, trade);

  return { state, orchestrator, events: trader.tradeEvents };
}

describe("orchestrator", function () {
  it("bogus-trader", async function () {
    const { events } = await setup({
      issuer: bogusTrader,
      trade: {
        asset: "BTC",
        dir: "buy",
        openPrice: 20_000,
        amount: 1000,
        leverage: 100,
        owner: bogusTrader,
        clientTradeId: 2000,
        tradeId: 1000,
        status: "filled",
        closePrice: undefined,
      },
    });
    assert.deepEqual([], events);
  });

  it("monitored-fill_my-cancel", async function () {
    const trade1: Trade = {
      asset: "BTC",
      dir: "sell",
      openPrice: 20_000,
      amount: 1000,
      leverage: 100,
      owner: monitoredTrader,
      clientTradeId: undefined,
      tradeId: 1000,
      status: "filled",
      closePrice: undefined,
    };
    const expTrade: Trade = {
      amount: 100,
      clientTradeId: 0,
      dir: "sell",
      leverage: 10,
      openPrice: 20_000,
      owner: wallet.address,
      asset: "BTC",
    };

    // ignore the second event
    const { state, events } = await setup(
      { issuer: monitoredTrader, trade: trade1 },
      { issuer: wallet.address, trade: { ...expTrade, status: "cancelled" } },
      { issuer: monitoredTrader, trade: { ...trade1, status: "closed" } } // should be ignored - already cancelled
    );

    assert.deepEqual([{ event: "createTrade", trade: expTrade }], events);
    assert.strictEqual(1, state.myTrades.length);
    assert.deepEqual({ ...expTrade, status: "cancelled" }, state.myTrades[0][1]);
    assert.deepEqual({ ...expTrade, status: "cancelled" }, state.openTrades.get("BTC"));
  });

  it("monitored-fill_monitored-close", async function () {
    const trade1: Trade = {
      asset: "BTC",
      dir: "sell",
      openPrice: 20_000,
      amount: 1000,
      leverage: 100,
      owner: monitoredTrader,
      clientTradeId: undefined,
      tradeId: 1000,
      status: "filled",
      closePrice: undefined,
    };
    const trade2 = { ...trade1, tradeId: 1001 };
    const expTrade: Trade = {
      amount: 100,
      clientTradeId: 0,
      dir: "sell",
      leverage: 10,
      openPrice: 20_000,
      owner: wallet.address,
      asset: "BTC",
    };
    const trade3: Trade = { ...trade1, tradeId: 1003, closePrice: 30_000, status: "closed" }; // close on the same asset, even with diff tradeId

    // ignore the second event
    const { state, events } = await setup(
      { issuer: monitoredTrader, trade: trade1 },
      { issuer: monitoredTrader, trade: trade2 }, // ignored
      { issuer: wallet.address, trade: { ...expTrade, status: "filled" } },
      { issuer: monitoredTrader, trade: trade3 },
      { issuer: wallet.address, trade: { ...expTrade, closePrice: 35_000, status: "closed" } }
    );

    assert.deepEqual(
      [
        { event: "createTrade", trade: expTrade },
        { event: "closeTrade", clientTradeId: 0 },
      ],
      events
    );
    assert.strictEqual(1, state.myTrades.length);
    assert.deepEqual({ ...expTrade, status: "closed", closePrice: 35_000 }, state.myTrades[0][1]);
    assert.deepEqual(undefined, state.openTrades.get("BTC"));
  });

  it("multiple-assets", async function () {
    throw new Error("Unimplemented!");
  });

  it("longer-scenario", async function () {
    // run trades across 3 assets, with fills, closes, cancels, on monitored, bogus and myPubkey
    throw new Error("Unimplemented!");
  });
});
