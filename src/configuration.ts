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
  traderChainSpec: "polygon" | "arbitrum" | "mumbai";
  listenerChainSpec: "polygon" | "arbitrum" | "mumbai";
  mockParams?: MockParams;
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
  const walletPrivKey = fs.readFileSync("./wallet.txt", "utf8").trim();
  config.wallet = new Wallet(walletPrivKey);
  validateSchema(config, require("../config.schema.json"));
  if (config.wallet.address.toUpperCase() == config.monitoredTrader.toUpperCase()) throw new Error(`Cannot have my wallet.address == config.monitoredTrader!`);
  return config;
}

export function validateSchema(config: any, configSchema: any) {
  const ajvInst = new ajv({ strictTuples: false });
  configSchema["$schema"] = undefined;
  const validate = ajvInst.compile(configSchema);
  const valid = validate(config) as boolean;
  if (!valid) throw new Error(`Failed to validate config due to errors ${JSON.stringify(validate.errors)}`);
}
