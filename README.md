# Gains Network bot

[![build](../../workflows/build/badge.svg)](../../actions/workflows/build.yml)

## Setup

```sh
npm i
cp config.dev.json config.json
# or cp config.prod.json config.json
echo "my wallet priv key" > wallet.txt
```

## Test

```sh
npm test
```

## Run

```sh
src/app.ts
# point the browser at localhost:85/dashboard
```

## CLI

Manually test commands

```sh
# infrastructure
src/cli.ts watchPrices                         # monitor prices via ccxt
src/cli.ts watchGasPrices                      # monitor gas prices
src/cli.ts showKeys                            # display used private and public keys
src/cli.ts publishNotification "test message"

# gTrade specific
src/cli.ts gTradeStats
src/cli.ts issueTrade --pair btc --price 23390 --size 100 --leverage 20 --stopLoss 0 --takeProfit 23500 --slippage 0.01             # buy:  price > mark
src/cli.ts issueTrade --pair btc --price 23350 --size 100 --leverage 20 --stopLoss 23500 --takeProfit 0 --slippage 0.01 --dir sell  # sell: price < mark
src/cli.ts issueTrade --pair eth --price 1641 --size 100 --leverage 20 --stopLoss 0 --takeProfit 1650 --slippage 0.01
src/cli.ts issueMarketTrade --pair eth --size 100 --leverage 20 --stopLoss 0 --takeProfit 1650 --slippage 0.01
src/cli.ts getOpenTrades --pair eth
src/cli.ts closeTrade --pair eth --orderIndex 0
```
