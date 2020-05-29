'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection } = require ('./base/errors');
const CryptoJS = require ('./static_dependencies/crypto-js/crypto-js');
//  ---------------------------------------------------------------------------

module.exports = class hotbit extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'hotbit',
            'name': 'HotBit',
            'countries': ['EE'],
            'rateLimit': 1000,
            'has': {
                'CORS': false,
                //public
                'fetchOrderBook': true,
                'fetchTrades': true,
                'fetchMarkets': true,
                'fetchTicker': true,
                // 'fetchTickers': true,
                //private
                'fetchBalance': true,
                'fetchOpenOrders': true,
                'fetchClosedOrders': true,
                'fetchMyTrades': true,
                'createOrder': true,
                'cancelOrder': true,
                'cancelOrders': true,
            },
            'headers': {
                'Language': 'en_US',
            },
            'urls': {
                'logo': 'https://assets.coingecko.com/markets/images/201/large/hotbit.jpg?1531043195',
                'api': 'https://api.hotbit.io/api/v1',
                'www': 'https://www.hotbit.io/',
                'doc': 'https://github.com/hotbitex/hotbit.io-api-docs/wiki/Rest-API-Doc',
            },
            'api': {
                'public': {
                    'get': [
                        'market.list',//get markets
                        'allticker',//get tickers 
                        'market.status',//get ticker 
                        'order.depth',//get orderbook
                        'market.deals',//get trades
                    ]
                },
                'private': {
                    'post': [
                        'balance.query',//get balances
                        'order.pending',//get open orders
                        'order.finished',//get close orders
                        'market.user_deals',//get trade history
                        'order.put_limit',//create order
                        'order.cancel',//cancel order
                        'order.batch_cancel',//cancel up to 10 orders at the same time 
                    ],
                },
            },
        });
    }

    async fetchMarkets () {
    // [
    //     {
        //     money_prec: 8,
        //     name: "QASHBTC",
        //     fee_prec: 4,
        //     stock: "QASH",
        //     money: "BTC",
        //     min_amount: "0.1",
        //     stock_prec: 2
    //     },
    //     ...
    // ]
        const response = await this.publicGetMarketList();
        const markets = response.result;
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            let market = markets[i];
            let id = this.safeString(market, 'name').toLowerCase();
            let base = this.safeString(market, 'stock');
            let quote = this.safeString(market, 'money');
            let symbol = `${base}/${quote}`;
            let fee_prec = this.safeString(market, 'fee_prec');
            let stock_prec = this.safeString(market, 'stock_prec');
            let money_prec = this.safeString(market, 'money_prec');
            let min_amount = this.safeString(market, 'min_amount');

            result.push({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'fee_precision': fee_prec,
                'ask_precision': stock_prec,
                'bid_precision': money_prec,
                'minimum_amount': min_amount,
                'info': market,
            });
        }
        return result;
    }

    async fetchTicker (symbol, params = {}) {
        // {
        //     "period": 10,
        //     "last": "0.0743",
        //     "open": "0.074162",
        //     "close": "0.0743",
        //     "high": "0.0743",
        //     "low": "0.074162",
        //     "volume": "0.314",
        //     "deal": "0.023315531"
        // }
        const request = {
            'market': symbol,
            'period': 10,
        };
        const response = await this.publicGetMarketStatus(this.extend (request, params));
        const ticker = response.result;        
        const last = Number(ticker.last);
        const open = Number(ticker.open);
        const close = Number(ticker.close);
        const high = Number(ticker.high);
        const low = Number(ticker.low);
        const volume = Number(ticker.volume);
        const deal = Number(ticker.deal);
        const timestamp = response.id;
        const datetime = this.iso8601 (timestamp);

        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': datetime,
            'bid': undefined,
            'bidVolume': undefined,
            'ask': undefined,
            'askVolume': undefined,
            'vwap': undefined,
            'low': low,
            'high': high,
            'last': last,
            'open': open,
            'close': close,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': deal,
            'quoteVolume': volume,
            'info': ticker,
        };;
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        // await this.loadMarkets ();
        const request = {
            'market': symbol,
            'limit': limit > 100 ? 100 : limit,
            'interval': 1e-8,
        };
        //order.depth
        const response = await this.publicGetOrderDepth (this.extend (request, params));
        const orderbook = response.result;
        const timestamp = response.id * 1000;
        return this.parseOrderBook (orderbook, timestamp, 'bids', 'asks', 0, 1);
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        const request = {
            'market': symbol,
            'limit': limit ? limit : 10,
            'last_id': 1,
        };
        const response = await this.publicGetMarketDeals (this.extend (request, params));
        const trades = response.result;
        const result = [];
        for (let i = 0; i < trades.length; i++) {
            const trade = trades[i];
            result.push({
                ...trade,
                symbol,
            });
        }
        // console.log("result", result)
        return this.parseTrades(result, symbol, since, limit);
    }

    parseTrade (trade, market = undefined) {
        // console.log("trade", trade)
        // {
        //     id: 1534853012,
        //     time: 1590434061.552552,
        //     price: "8924.79",
        //     amount: "0.308321",
        //     type: "sell"
        // },
        const id = this.safeString (trade, 'id');
        const timestamp = trade.time;
        const datetime = this.iso8601(timestamp * 1000);
        const amount = this.safeString (trade, 'amount');
        const price = this.safeString (trade, 'price');
        const side = this.safeString (trade, 'type');

        return {
            'id': id,
            'info': trade,
            'timestamp': timestamp,
            'datetime': datetime,
            'symbol': market,
            'order': id,
            'type': undefined,
            'side': side,
            'takerOrMaker': undefined,
            'price': Number(price),
            'amount': Number(amount),
            'cost': Number(price) * Number(amount),
            'fee': undefined,
        };
    }

    async fetchBalance () {
        const request = {
            'assets': '[]',
        };
        console.log("request", request, this.extend(request))
        //balance.query
        const response = await this.privatePostBalanceQuery (this.extend(request));
        console.log(response)
        // {
        //     error: null,
        //     id: 1590775763,
        //     result: {
        //       WNL: { available: '0', freeze: '0' },
        //       ETH: { available: '0', freeze: '0' },
        //       GOD: { available: '0', freeze: '0' },
        //       ...
        //     },
        //     ieo_use: '0'
        //   }
        const balances = this.safeValue (response, 'result');
        const result = { 'info': response };
        const keys = Object.keys(balances);
        const values = Object.values(balances);

        for (let i = 0; i < keys.length; i++) {
            const balance = balances[keys[i]];
            console.log("balance", balance)
            // const currencyId = this.safeString (balance, 'name');
            const currencyId = keys[i];
            console.log("currencyId", currencyId)
            const code = this.safeCurrencyCode (currencyId);
            const account = this.account ();
            account['free'] = this.safeFloat (balance, 'available');
            account['used'] = this.safeFloat (balance, 'freeze');
            const total = this.safeFloat (balance, 'available') + this.safeFloat (balance, 'freeze');
            account['total'] = total;
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = 50, params = {}) {
        //market=ETH/BTC&offset=0&limit=100
        const request = {
            'market': symbol,
            'offset': 0,
            'limit': limit,
        };
        const response = await this.privatePostOrderPending (this.extend(request));
        const marketPairName = symbol.split('/').join();
        const openOrders = response.result[marketPairName].records;

        return this.parseOrders (openOrders, symbol, since, limit);
    }

    parseOrder (order, market = undefined) {
        const { id, ctime, type } = order;
        const timestamp = ctime;
        const datetime = this.iso8601(timestamp);
        const symbol = market;
        const status = order.status;
        const price = this.safeFloat(order, 'price');
        const side = type === 1 ? "sell" : "buy";
        const amount = this.safeFloat(order, 'amount');
        const cost = Number(order.price) * Number(order.amount);
        const remaining = this.safeFloat(order, 'left');
        const fee = this.safeFloat(order, 'taker_fee');
        return {
            'id': id,
            'timestamp': timestamp,
            'datetime': datetime,
            'lastTradeTimestamp': undefined,
            'status': status,
            'symbol': symbol,
            'type': "limit",
            'side': side,
            'price': price,
            'average': undefined,
            'cost': cost,
            'amount': amount,
            'filled': undefined,
            'remaining': remaining,
            'fee': fee,
            'info': order,
        }
    }

    async fetchClosedOrders (symbol = undefined, since = undefined, limit = 50, params = {}) {
        //market=ETH/BTC&start_time=1511967657&end_time =1512050400&offset=0&limit=100&side=1
        const request = {
            'market': symbol,
            'offset': 0,
            'limit': limit,
            'start_time': this.seconds (),
            'end_time': new Date ("May 28 2020").getTime() / 1000,//temp
        };
        const responseSell = await this.privatePostOrderFinished (this.extend({ ...request, side: 1 }));
        const responseBuy = await this.privatePostOrderFinished (this.extend({ ...request, side: 2 }));
        const marketPairName = symbol.split('/').join();
        const closedOrdersBuy = responseSell.result[marketPairName].records;
        const closedOrdersSell = responseBuy.result[marketPairName].records;
        const closedAllOrders = [ ...closedOrdersBuy, ...closedOrdersSell ].sort((a, b) => b.id - a.id);

        return this.parseOrders (closedAllOrders, symbol, since, limit);
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        //market.user_deals
        const request = {
            'market': symbol,
            'offset': 0,
            'limit': limit,
        };
        const response = await this.privatePostMarketUserDeals (this.extend(request));
        //what is an actual response? No info in api docs.
        return this.parseTrades (response, symbol, since, limit);
    }

    async createOrder (symbol, type = 'limit', side, amount, price = undefined, params = {}) {
        //order.put_limit
        //Only 200 orders are allowed to be placed simultaneously under the same transaction pair
        const request = {
            'market': symbol,
            'side': side === "sell" ? 1 : 2, //1 = "sell"，2="buy"
            'amount': amount,
            'price': price,
            'isFee': 1, //????Use deductable token to deduct or not 0 = "no(no)"，1="yes(yes)"
        };
        const response = await this.privatePostOrderPutLimit (this.extend(request, params));
        const data = response.result;
        // const { id } = data;
        return {
            'id': data.id,
            'info': data,
        }
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        //order.cancel
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' cancelOrder() requires a `symbol` argument');
        }
        const request = {
            'market': symbol,
            'order_id': id,
        };
        const response = await this.privatePostOrderCancel (this.extend(request, params));
        const data = response.result;
        // const { id } = data;
        return {
            'id': data.id,
            'info': data,
        }
    }

    async cancelOrders (ids, symbol = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' cancelOrders() requires a `symbol` argument');
        }
        const request = {
            'market': symbol,
            'order_ids': ids,
        };
        const response = await this.privatePostOrderBatchCancel (this.extend(request, params));
        const data = response.result;
        return data;
    }
    
    createSignature (params) {
        const query = [];
        for (let i in params) {
            console.log("params", params[i])
            query.push(`${i}=` + params[i]);
        };
        const sortedQueryArray = query.sort();
        // console.log("sortedQueryArray", sortedQueryArray)
        const queryString = sortedQueryArray.join('&');
        sortedQueryArray.push('secret_key=' + this.secret);
        const queryStringWithSecret = sortedQueryArray.join('&');
        // console.log("queryStringWithSecret", queryStringWithSecret)
        const signature = this.hash(this.encode(queryStringWithSecret), 'md5').toUpperCase();
        // console.log("signature", signature)
        return {
            signature,
            queryString,
        };
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let request = '/';
        request += path;
        
        console.log("params", params)
        console.log("path", path)
        console.log("api", api)
        console.log("method", method)

        if (api === 'private') {
            const { signature, queryString } = this.createSignature({ ...params, api_key: this.apiKey });
            // request += '?' + this.urlencode ({ ...queryString, sign: signature });
            // request += `?${queryString}&sign=${signature}`;
            // console.log("request", request)
            // body = this.json (`${queryString}&sign=${signature}`);
            body = `${queryString}&sign=${signature}`;
            // if (Object.keys (params).length) {
            // }
            console.log("body", body)
        } else {
            if (Object.keys (params).length) {
                request += '?' + this.urlencode (params);
            }
        }

        const url = this.urls['api'] + request;
        console.log('url', url)
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
}