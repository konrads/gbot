import fs from "fs";
import { GasPriceOracle } from "gas-price-oracle";
import { EstimatedGasPrice } from "gas-price-oracle/lib/services";

export function toDDMMMYY(date: Date): string {
  const months = [`JAN`, `FEB`, `MAR`, `APR`, `MAY`, `JUN`, `JUL`, `AUG`, `SEP`, `OCT`, `NOV`, `DEC`];
  let dd = date.getDate() >= 10 ? `${date.getDate()}` : `0${date.getDate()}`;
  let mmm = months[date.getMonth()];
  let yy = `${date.getFullYear()}`.slice(2);
  return `${dd}${mmm}${yy}`;
}

export function schedule(closure: () => void, interval: number): NodeJS.Timer {
  // call first time
  (async () => {
    closure();
  })();
  // schedule subsequent
  return setInterval(closure, interval);
}

export function unique<T>(ts: T[]): T[] {
  return Array.from(new Set(ts));
}

export function groupBy<T, K>(ts: T[], getKey: (t: T) => K): [K, T[]][] {
  const grouped = new Map();
  for (var t of ts) {
    const key = getKey(t);
    let forKey = grouped.get(key);
    if (!forKey) grouped.set(key, [t]);
    else forKey.push(t);
  }
  return Array.from(grouped.entries());
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toFixed(x: number, fractionDigits: number): number {
  if (x != undefined) {
    return +x.toFixed(fractionDigits);
  }
}

export function capFirst(str: string): string {
  if (str && str.length > 0) return str.charAt(0).toUpperCase() + str.slice(1);
}

// generates ids based on current timestamp.
// NOTE: assumes only 1 creator to exist at the time, and the rate of id generation to be > 1/ms (in case creator is re-initialized)
// based on Atomics: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/add
export function idCreator(start?: number): () => number {
  const buffer = new SharedArrayBuffer(BigInt64Array.BYTES_PER_ELEMENT);
  const uint32 = new BigInt64Array(buffer);
  uint32[0] = BigInt(start ?? Date.now());
  function createId(): number {
    return Number(Atomics.add(uint32, 0, 1n));
  }
  return createId;
}

export function bumpRestartCount(): number {
  const restartsCntFilename = "restart-cnt.txt";
  let restartCnt = 0;
  try {
    restartCnt = +fs.readFileSync(restartsCntFilename);
  } catch (e) {}
  restartCnt += 1;
  fs.writeFileSync(restartsCntFilename, "" + restartCnt);
  return restartCnt;
}

export function randomVal<T>(arr: T[]): T {
  const ind = Math.floor(Math.random() * arr.length);
  return arr[ind];
}

export function randomPlusPerc(base: number, perc: number): number {
  return base + base * perc * 2 * (Math.random() - 0.5);
}

export async function getGasPrice(): Promise<EstimatedGasPrice> {
  const oracle = new GasPriceOracle({ chainId: 137 }); // Polygon
  return await oracle.eip1559.estimateFees({
    maxFeePerGas: 20,
    maxPriorityFeePerGas: 3,
    baseFee: undefined,
  });
}

export function range(n: number): number[] {
  return [...Array(n).keys()];
}
