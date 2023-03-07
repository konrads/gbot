import { Trade, Price, TradeId, Asset } from "./types";

export class State {
  private readonly prices: Map<string, Price> = new Map();
  private readonly assetz: string[];
  private readonly myCurrentTradez: Map<Asset, TradeId> = new Map();
  private readonly tradesByClientTradeId: Map<TradeId, Trade> = new Map();
  private readonly myTsTrades: [number, TradeId][] = [];

  constructor(assets: string[]) {
    this.assetz = assets;
  }

  get assets(): string[] {
    return this.assetz;
  }

  get pnl(): number {
    return this.myTrades
      .filter(([_, trade]) => trade.status == "filled")
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

  setTrade(trade: Trade) {
    const registeredTrade = this.tradesByClientTradeId.get(trade.clientTradeId);
    if (trade.status == undefined) {
      this.tradesByClientTradeId.set(trade.clientTradeId, trade);
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

  get openTrades(): Map<Asset, Trade> {
    return new Map([...this.myCurrentTradez.entries()].map(([asset, clientTradeId]) => [asset, this.tradesByClientTradeId.get(clientTradeId)]));
  }

  get myTrades(): [number, Trade][] {
    return this.myTsTrades.map(([ts, clientTradeId]) => [ts, this.tradesByClientTradeId.get(clientTradeId)]);
  }
}
