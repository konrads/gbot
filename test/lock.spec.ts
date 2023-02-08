import * as assert from "assert";
import { LockedRunner } from "../src/lock";
import { sleep } from "../src/utils";

const SLEEP_TIME = 100;

describe("lock", function () {
  it("runExclusively without wait", async function () {
    let i = 0;
    async function incr() {
      i++;
      return i;
    }
    const runner = new LockedRunner(SLEEP_TIME, ["x", "y"]);

    const t0 = Date.now();
    let [res, hasRan] = await runner.runExclusive("x", "reject", incr);
    assert.strictEqual(true, hasRan);
    assert.strictEqual(1, res);
    [res, hasRan] = await runner.runExclusive("x", "reject", incr);
    assert.strictEqual(false, hasRan);
    assert.strictEqual(undefined, res);
    const t1 = Date.now();
    assert.strictEqual(true, t1 - t0 < SLEEP_TIME);

    await sleep(SLEEP_TIME);
    [res, hasRan] = await runner.runExclusive("x", "reject", incr);
    assert.strictEqual(true, hasRan);
    assert.strictEqual(2, res);
  });

  it("runExclusively with wait", async function () {
    let i = 0;
    async function incr() {
      i++;
      return i;
    }
    const runner = new LockedRunner(SLEEP_TIME, ["x", "y"]);

    const t0 = Date.now();
    let [res, hasRan] = await runner.runExclusive("y", "wait", incr);
    assert.strictEqual(true, hasRan);
    assert.strictEqual(1, res);
    [res, hasRan] = await runner.runExclusive("y", "wait", incr);
    assert.strictEqual(true, hasRan);
    assert.strictEqual(2, res);
    [res, hasRan] = await runner.runExclusive("y", "wait", incr);
    assert.strictEqual(true, hasRan);
    assert.strictEqual(3, res);
    const t1 = Date.now();
    const tsDelta = t1 - t0;
    assert.strictEqual(
      true,
      tsDelta > SLEEP_TIME * 2 && tsDelta < SLEEP_TIME * 3
    );
  });
});
