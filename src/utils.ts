import fs from "fs";
import { Trade } from "./gtrade";

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

export function toFixed(x: number | undefined, fractionDigits: number): number | undefined {
  if (x != undefined) {
    return +x.toFixed(fractionDigits);
  }
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

export function range(n: number): number[] {
  return [...Array(n).keys()];
}

// For a single trade - return that trade.
// For multiple trades, sum up positionSizeDai: positionSizeDai * leverage * dir, convert leverage to 1, set buy based on positionSizeDai
export function aggregateTrades(trades: Trade[]): Trade {
  return trades.reduce((x, y) => {
    if (!x) return y;
    else {
      const xPosition = x.positionSizeDai * x.leverage * (x.buy ? 1 : -1);
      const yPosition = y.positionSizeDai * y.leverage * (y.buy ? 1 : -1);
      const positionSizeDai = xPosition + yPosition;
      const buy = positionSizeDai > 0;
      const leverage = 1;
      return { ...x, positionSizeDai: Math.abs(positionSizeDai), buy, leverage };
    }
  }, undefined);
}

export function translateError(error): any {
  const asStr = `${error}`;
  const knownErrors = ["Transaction has been reverted by the EVM"];
  for (var knownError of knownErrors) {
    if (asStr.includes(knownError)) return knownError;
  }
  return error;
}
