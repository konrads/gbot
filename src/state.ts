import { addCodeArg } from "ajv/dist/compile/codegen/code";
import { Trade, Price, TradeId, Asset } from "./types";

export class State {
  private readonly prices: Map<string, Price> = new Map();
  private readonly assetz: string[];
  private readonly myCurrentTradez: Map<Asset, TradeId> = new Map();
  private readonly myTradesByClientTradeId: Map<TradeId, Trade> = new Map();
  private readonly myTsTrades: [number, TradeId][] = [];
  private readonly monitoredTsTrades: [number, TradeId][] = [];
  private readonly monitoredTradesByTradeId: Map<TradeId, Trade> = new Map();

  constructor(assets: string[]) {
    this.assetz = assets;
  }

  get assets(): string[] {
    return this.assetz;
  }

  get myPnl(): number {
    return this.myTrades
      .filter(([_, trade]) => trade.status == "closed")
      .map(([_, trade]) => {
        const dirMult = trade.dir == "buy" ? 1 : -1;
        return (trade.closePrice - trade.openPrice) * dirMult * trade.amount * trade.leverage;
      })
      .reduce((x, y) => x + y, 0);
  }

  get monitoredPnl(): number {
    return this.monitoredTrades
      .filter(([_, trade]) => trade.status == "closed")
      .map(([_, trade]) => {
        const dirMult = trade.dir == "buy" ? 1 : -1;
        return (trade.closePrice - trade.openPrice) * dirMult * trade.amount * trade.leverage;
      })
      .reduce((x, y) => x + y, 0);
  }

  setPrice(asset: string, price: number) {
    this.prices.set(asset, { price, ts: new Date() });
  }

  getPrice(asset: string): Price {
    return this.prices.get(asset);
  }

  setMyTrade(trade: Trade) {
    const registeredTrade = this.myTradesByClientTradeId.get(trade.clientTradeId);
    if (trade.status == undefined) {
      this.myTradesByClientTradeId.set(trade.clientTradeId, trade);
      this.myTsTrades.push([Date.now(), trade.clientTradeId]);
      this.myCurrentTradez.set(trade.asset, trade.clientTradeId);
    } else if (registeredTrade && [undefined, "placed"].includes(registeredTrade.status) && trade.status == "cancelled") {
      registeredTrade.status = trade.status;
    } else if (registeredTrade && [undefined, "placed"].includes(registeredTrade.status) && trade.status == "filled") {
      registeredTrade.openPrice = trade.openPrice;
      registeredTrade.status = "filled";
    } else if (registeredTrade?.status == "filled" && trade.status == "closed") {
      registeredTrade.closePrice = trade.closePrice;
      registeredTrade.status = "closed";
      this.myCurrentTradez.set(trade.asset, undefined);
    }
  }

  setMonitoredTrade(trade: Trade) {
    const registeredTrade = this.monitoredTradesByTradeId.get(trade.tradeId);
    if (registeredTrade) {
      registeredTrade.status = trade.status;
      if (trade.openPrice) registeredTrade.openPrice = trade.openPrice;
      if (trade.closePrice) registeredTrade.closePrice = trade.closePrice;
    } else {
      this.monitoredTradesByTradeId.set(trade.tradeId, trade);
      this.monitoredTsTrades.push([Date.now(), trade.tradeId]);
    }
  }

  get openTrades(): Map<Asset, Trade> {
    return new Map([...this.myCurrentTradez.entries()].map(([asset, clientTradeId]) => [asset, this.myTradesByClientTradeId.get(clientTradeId)]));
  }

  get myTrades(): [number, Trade][] {
    return this.myTsTrades.map(([ts, clientTradeId]) => [ts, this.myTradesByClientTradeId.get(clientTradeId)]);
  }

  get monitoredTrades(): [number, Trade][] {
    return this.monitoredTsTrades.map(([ts, tradeId]) => [ts, this.monitoredTradesByTradeId.get(tradeId)]);
  }
}
