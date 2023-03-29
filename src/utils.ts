import fs from "fs";

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

export function shortPubkey(pubkey: string): string {
  const i0 = 0;
  const i1 = 5;
  const i2 = pubkey.length - 4;
  const i3 = pubkey.length;
  if (i2 > i1) return `${pubkey.slice(i0, i1)}...${pubkey.slice(i2, i3)}`;
  else return pubkey;
}
