# Gains Network bot

[![build](../../workflows/build/badge.svg)](../../actions/workflows/build.yml)

## Setup

```sh
npm i
cp config.dev.json config.json
# or cp config.prod.json config.json
# create wallet.json, holding number array private key
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
src/cli.ts watchPrices
src/cli.ts publishNotification "test message"
```
