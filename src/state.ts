import { Trade, Price, TradeId, Symbol } from "./types";

export class State {
  private readonly prices: Map<string, Price> = new Map();
  private readonly symbolz: string[];
  private readonly myCurrentTradez: Map<Symbol, TradeId> = new Map();
  private readonly tradesByClientTradeId: Map<TradeId, Trade> = new Map();
  private readonly myTsTrades: [number, TradeId][] = [];

  constructor(symbols: string[]) {
    this.symbolz = symbols;
  }

  get symbols(): string[] {
    return this.symbolz;
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

  setPrice(symbol: string, price: number) {
    this.prices.set(symbol, { price, ts: new Date() });
  }

  getPrice(symbol: string): Price {
    return this.prices.get(symbol);
  }

  setTrade(trade: Trade) {
    const registeredTrade = this.tradesByClientTradeId.get(trade.clientTradeId);
    if (trade.status == undefined) {
      this.tradesByClientTradeId.set(trade.clientTradeId, trade);
      this.myTsTrades.push([Date.now(), trade.clientTradeId]);
      this.myCurrentTradez.set(trade.symbol, trade.clientTradeId);
    } else if (registeredTrade && trade.status == "placed") {
      registeredTrade.status = trade.status;
    } else if (registeredTrade && trade.status == "filled") {
      registeredTrade.openPrice = trade.openPrice;
      registeredTrade.status = "filled";
    } else if (registeredTrade && trade.status == "closed") {
      registeredTrade.closePrice = trade.closePrice;
      registeredTrade.status = "closed";
      this.myCurrentTradez.set(trade.symbol, undefined);
    }
  }

  get openTrades(): Map<Symbol, Trade> {
    return new Map([...this.myCurrentTradez.entries()].map(([symbol, clientTradeId]) => [symbol, this.tradesByClientTradeId.get(clientTradeId)]));
  }

  get myTrades(): [number, Trade][] {
    return this.myTsTrades.map(([ts, clientTradeId]) => [ts, this.tradesByClientTradeId.get(clientTradeId)]);
  }
}
