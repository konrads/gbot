import * as assert from "assert";
import { Trade } from "../src/gtrade";
import { unique, groupBy, toFixed, aggregateTrades } from "../src/utils";

describe("utils", function () {
  it("unique", function () {
    assert.deepEqual([1, 2, 3], unique([1, 2, 3, 3, 2, 1, 2, 3]));
  });

  it("groupBy", function () {
    const m = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    assert.deepEqual(
      new Map([
        [0, [0, 3, 6, 9]],
        [1, [1, 4, 7]],
        [2, [2, 5, 8]],
      ]),
      new Map(groupBy(m, (x) => x % 3))
    );
  });

  it("toFixed", function () {
    let x = 1230.045019;
    assert.strictEqual(1230, toFixed(x, 0));
    assert.strictEqual(1230, toFixed(x, 1));
    assert.strictEqual(1230.05, toFixed(x, 2)); // rounded up
    assert.strictEqual(1230.045, toFixed(x, 3));
    assert.strictEqual(1230.045, toFixed(x, 4));
    assert.strictEqual(1230.04502, toFixed(x, 5)); // rounded up
    assert.strictEqual(1230.045019, toFixed(x, 6));
    assert.strictEqual(1230.045019, toFixed(x, 7));

    x = 123.451;
    assert.strictEqual(123, toFixed(x, 0));
    assert.strictEqual(123.5, toFixed(x, 1)); // rounded up
    assert.strictEqual(123.45, toFixed(x, 2));
    assert.strictEqual(123.451, toFixed(x, 3));

    x = 0;
    assert.strictEqual(0, toFixed(x, 2));

    x = -0;
    assert.strictEqual(0, toFixed(x, 2));

    x = 0.001;
    assert.strictEqual(0, toFixed(x, 2));
  });

  it("aggregateTrades", function () {
    const t0: Trade = {
      positionSizeDai: 10,
      buy: true,
      leverage: 5,
      // can ignore...
      trader: "0x111",
      pair: "btc",
      index: 0,
      openPrice: -1,
      initialPosToken: -1,
      tp: -1,
      sl: -1,
    };
    const t1: Trade = { ...t0, positionSizeDai: 20, leverage: 4, buy: false };
    const t2: Trade = { ...t0, positionSizeDai: 30, leverage: 3, buy: true };
    let res = aggregateTrades([t0]);
    assert.deepEqual([10, 5, true], [res.positionSizeDai, res.leverage, res.buy]); // returns t0
    res = aggregateTrades([t0, t1]);
    assert.deepEqual([30, 1, false], [res.positionSizeDai, res.leverage, res.buy]); // falls into sell
    res = aggregateTrades([t0, t1, t2]);
    assert.deepEqual([60, 1, true], [res.positionSizeDai, res.leverage, res.buy]); // falls back into buy
  });
});
