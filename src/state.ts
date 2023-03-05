import { Trade, Price, TradeId, Symbol } from "./types";

export class State {
  private readonly prices: Map<string, Price> = new Map();
  private readonly assetz: string[];
  private readonly myCurrentTradez: Map<Symbol, TradeId> = new Map();
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
    if (trade.status == undefined) {
      this.tradesByClientTradeId.set(trade.clientTradeId, trade);
      this.myTsTrades.push([Date.now(), trade.clientTradeId]);
      this.myCurrentTradez.set(trade.symbol, trade.clientTradeId);
    } else if (trade.status == "placed" || trade.status == "cancelled") {
      this.tradesByClientTradeId.get(trade.clientTradeId).status = trade.status;
    } else if (trade.status == "filled") {
      this.tradesByClientTradeId.get(trade.clientTradeId).openPrice = trade.openPrice;
      this.tradesByClientTradeId.get(trade.clientTradeId).status = "filled";
    } else if (trade.status == "closed") {
      this.tradesByClientTradeId.get(trade.clientTradeId).closePrice = trade.closePrice;
      this.tradesByClientTradeId.get(trade.clientTradeId).status = "closed";
      this.myCurrentTradez.set(trade.symbol, undefined);
    }
  }

  get openTrades(): Map<Symbol, Trade> {
    return new Map([...this.myCurrentTradez.entries()].map(([asset, clientTradeId]) => [asset, this.tradesByClientTradeId.get(clientTradeId)]));
  }

  get myTrades(): [number, Trade][] {
    return this.myTsTrades.map(([ts, clientTradeId]) => [ts, this.tradesByClientTradeId.get(clientTradeId)]);
  }
}
