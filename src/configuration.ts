import ajv from "ajv";
import { Wallet } from "ethers";
import * as fs from "fs";

export interface Notifications {
  telegramToken: string;
  telegramChatId: string;
}

export interface Asset {
  gainsTicker: string;
  refTicker: string;
}

export interface Config {
  network: "devnet" | "mainnet";
  mockParams?: MockParams;
  endpoint: string;
  refExchange: string;
  lockingIntervalMs: number;
  markPriceStaleIntervalMs: number;
  webServerPort: number;
  notifications?: Notifications;
  assets: Asset[];
  monitoredTrader: string;
  wallet: Wallet;
}

export interface MockParams {
  fillCancelTrigger: number;
  fillCancelPerc: number;
  otherTraderTrigger: number;
  otherTraderPerc: number;
}

export function loadConfig(): Config {
  const config: Config = require("../config.json");
  const walletPrivKey = fs.readFileSync("./wallet.txt", "utf8");
  config.wallet = new Wallet(walletPrivKey);
  validateSchema(config, require("../config.schema.json"));
  return config;
}

export function validateSchema(config: any, configSchema: any) {
  const ajvInst = new ajv({ strictTuples: false });
  configSchema["$schema"] = undefined;
  const validate = ajvInst.compile(configSchema);
  const valid = validate(config) as boolean;
  if (!valid)
    throw new Error(
      `Failed to validate config due to errors ${JSON.stringify(
        validate.errors
      )}`
    );
}
