import ajv from "ajv";
import { Wallet } from "ethers";
import * as fs from "fs";

export interface Notifications {
  telegramToken: string;
  telegramChatId: string;
}

export interface AssetMapping {
  asset: string;
  cashAmount: number;
  leverage: number;
}

export interface Config {
  network: "devnet" | "mainnet";
  mockParams?: MockParams;
  endpoint: string;
  webServerPort: number;
  notifications?: Notifications;
  assetMappings: AssetMapping[];
  monitoredTrader: string;
  wallet: Wallet;
}

export interface MockParams {
  bogusTrader: string;
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
  if (!valid) throw new Error(`Failed to validate config due to errors ${JSON.stringify(validate.errors)}`);
}
