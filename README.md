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
src/cli.ts closeAllTrades
```

## EC2 deployment

Following is my setup, guided by desire not to be limited by network bandwidth (suits websockets). Note: following assumes:

- 18.214.16.179 is your ubuntu ec2 instance
- `gbot.pem` aws keypair has created
- `aws-deployment` priv key has been setup in github
- `<my-pub-key>` = your wallet priv key, with appropriate funds for given chain

```shell
scp ~/.ssh/aws-deployment ubuntu@18.214.16.179:~/.ssh
ssh -i ~/.ssh/gbot.pem ubuntu@18.214.16.179
# inside the ec2 terminal...
# ensure we can clone from github
chmod 400 ~/.ssh/aws-deployment
vi ~/.ssh/config
"
Host github.com
 HostName github.com
 IdentityFile ~/.ssh/aws-deployment
"
chmod 600 ~/.ssh/config
# install deps
sudo apt update
sudo apt install nodejs npm curl -y
curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
source ~/.bashrc
nvm install 16.6.0
sudo setcap cap_net_bind_service=+ep `which node`  # do if webServerPort != 80
# install repo
mkdir src && cd src
git clone git@github.com:konrads/gbot.git
cd gbot
npm i
cp config.dev.json config.json  # fix up monitoredTrader, etc!
echo "<my-pub-key>" > wallet.txt
node_modules/.bin/ts-node src/cli.ts
# try it out
node_modules/.bin/ts-node src/cli.ts showKeys
node_modules/.bin/ts-node src/cli.ts gTradeStats
# start the server
nohup node_modules/.bin/ts-node src/app.ts &
tail -f nohup.out
```
