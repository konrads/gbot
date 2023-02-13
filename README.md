# Gains Network bot

[![build](../../workflows/build/badge.svg)](../../actions/workflows/build.yml)

## Setup

```sh
npm i
cp config.dev.json config.json
# or cp config.prod.json config.json
# create wallet.txt, holding number array private key, eg. afdfd9c3d2095ef696594f6cedcae59e72dcd697e2a7521b1578140422a4f890
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
