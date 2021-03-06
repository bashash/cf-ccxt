'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection } = require('./base/errors');
const CryptoJS = require('./static_dependencies/crypto-js/crypto-js');
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
                        'server.time',//get server time
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

    async fetchMarkets() {
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

    async fetchTicker(symbol, params = {}) {
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
            'period': 86400,
        };
        const response = await this.publicGetMarketStatus(this.extend(request, params));
        const ticker = response.result;
        const last = Number(ticker.last);
        const open = Number(ticker.open);
        const close = Number(ticker.close);
        const high = Number(ticker.high);
        const low = Number(ticker.low);
        const volume = Number(ticker.volume);
        const deal = Number(ticker.deal);
        const timestamp = response.id;
        const datetime = this.iso8601(timestamp);

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

    async fetchOrderBook(symbol, limit = undefined, params = {}) {
        // await this.loadMarkets ();
        const request = {
            'market': symbol,
            'limit': limit > 100 ? 100 : limit,
            'interval': 1e-8,
        };
        //order.depth
        const response = await this.publicGetOrderDepth(this.extend(request, params));
        const orderbook = response.result;
        const timestamp = response.id * 1000;
        return this.parseOrderBook(orderbook, timestamp, 'bids', 'asks', 0, 1);
    }

    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        const request = {
            'market': symbol,
            'limit': limit ? limit : 10,
            'last_id': 1,
        };
        const response = await this.publicGetMarketDeals(this.extend(request, params));
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

    parseTrade(trade, market = undefined) {
        // console.log("trade", trade)
        // {
        //     id: 1534853012,
        //     time: 1590434061.552552,
        //     price: "8924.79",
        //     amount: "0.308321",
        //     type: "sell"
        // },
        const id = this.safeString(trade, 'id');
        const timestamp = trade.time;
        const datetime = this.iso8601(timestamp * 1000);
        const amount = this.safeString(trade, 'amount');
        const price = this.safeString(trade, 'price');
        const side = this.safeString(trade, 'type');

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

    async fetchBalance() {
        const request = {
            'assets': '[]',
        };
        //balance.query
        const response = await this.privatePostBalanceQuery(this.extend(request));
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
        const balances = this.safeValue(response, 'result');
        const result = { 'info': response };
        const keys = Object.keys(balances);

        for (let i = 0; i < keys.length; i++) {
            const balance = balances[keys[i]];
            const currencyId = keys[i];
            const code = this.safeCurrencyCode(currencyId);
            const account = this.account();
            account['free'] = this.safeFloat(balance, 'available');
            account['used'] = this.safeFloat(balance, 'freeze');
            const total = this.safeFloat(balance, 'available') + this.safeFloat(balance, 'freeze');
            account['total'] = total;
            result[code] = account;
        }
        return this.parseBalance(result);
    }

    async fetchOpenOrders(symbol = undefined, since = undefined, limit = 50, params = {}) {
        //market=ETH/BTC&offset=0&limit=100
        const request = {
            'market': symbol,
            'offset': 0,
            'limit': limit > 100 ? 100 : limit,
        };
        const response = await this.privatePostOrderPending(this.extend(request));
        // {
        //     error: null,
        //     id: 1590777388,
        //     result: { BTCUSDT: { limit: 10, offset: 0, total: 0, records: [] } }
        // }
        const marketPairName = symbol.split('/').join('');
        const openOrders = response.result[marketPairName].records;
        return this.parseOrders(openOrders, symbol, since, limit);
    }

    parseOrder(order, market = undefined) {
        // sample response of closed order
        // {
        //     id: 7832848716,
        //     taker_fee: '0.0020',
        //     create_time: 1591048246.248432,
        //     side: 1,
        //     finish_time: 1591048388.999197,
        //     user_id: 641936,
        //     t: 1,
        //     market: 'XRPUSDT',
        //     amount: '10.00000000',
        //     fee_stock: '',
        //     source: '96.49.166.3',
        //     deal_money: '0E-16',
        //     price: '0.2100000000000000',
        //     maker_fee: '-0.0005',
        //     deal_stock: '0E-8',
        //     deal_fee: '0E-16',
        //     status: 136,
        //     deal_fee_alt: '0E-16',
        //     alt_fee: '0.0000'
        // }
        // sample response of open order
        // {
        //     id: 7832848716,
        //     source: '96.49.166.3',
        //     market: 'XRPUSDT',
        //     ctime: 1591048246.248432,
        //     type: 1,
        //     fee_stock: '',
        //     side: 1,//#sign of buyer and seller 1-seller???2-buyer
        //     user: 641936,
        //     mtime: 1591048246.248432,
        //     price: '0.21',
        //     amount: '10',
        //     deal_stock: '0',
        //     taker_fee: '0.002',
        //     deal_fee: '0',
        //     maker_fee: '-0.0005',
        //     left: '10',
        //     deal_money: '0',
        //     alt_fee: '0',
        //     deal_fee_alt: '0',
        //     status: 128
        // }
        const { id, ctime } = order;
        const timestamp = ctime;
        const datetime = this.iso8601(timestamp);
        const symbol = market;
        const status = order.status;
        const price = this.safeFloat(order, 'price');
        const side = order.side === 1 ? "sell" : "buy";
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

    async fetchServerTime () {
        const response = await this.publicGetServerTime();
        // {
        //     error: null,
        //     result: 1590783963,
        //     id: 0
        // }
        const time = response.result;
        return time;
    }

    async fetchClosedOrders(symbol = undefined, since = undefined, limit = 50, params = {}) {
        const serverTime = await this.fetchServerTime();
        //market=ETH/BTC&start_time=1511967657&end_time =1512050400&offset=0&limit=100&side=1
        const request = {
            'market': symbol,
            'offset': 0,
            'limit': limit > 100 ? 100 : limit,
            'start_time': 1512050400,//temp
            'end_time': serverTime,
        };
        const responseSell = await this.privatePostOrderFinished(this.extend({ ...request, side: 1 }));
        const responseBuy = await this.privatePostOrderFinished(this.extend({ ...request, side: 2 }));
        // {
        //     error: null,
        //     result: { offset: 0, records: [], limit: 10 },
        //     id: 1590779677
        //   }
        const closedOrdersBuy = responseSell.result.records;
        const closedOrdersSell = responseBuy.result.records;
        const closedAllOrders = [...closedOrdersBuy, ...closedOrdersSell].sort((a, b) => b.id - a.id);

        return this.parseOrders(closedAllOrders, symbol, since, limit);
    }

    async fetchMyTrades(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        //market.user_deals
        const request = {
            'market': symbol,
            'offset': 0,
            'limit': limit,
        };
        const response = await this.privatePostMarketUserDeals(this.extend(request));
        // {
        //     error: null,
        //     result: { offset: 0, records: [], limit: 10 },
        //     id: 1590784865
        // }
        const trades = response.result.records;
        return this.parseTrades(trades, symbol, since, limit);
    }

    async createOrder(symbol, type = 'limit', side, amount, price = undefined, params = {}) {
        //order.put_limit
        //Only 200 orders are allowed to be placed simultaneously under the same transaction pair
        const request = {
            'market': symbol,
            'side': side === "sell" ? 1 : 2, //1 = "sell"???2="buy"
            'amount': amount,
            'price': price,
            'isfee': 1, //????Use deductable token to deduct or not 0 = "no(no)"???1="yes(yes)"
        };
        const response = await this.privatePostOrderPutLimit(this.extend(request, params));
        const data = response.result;
        return {
            'id': data.id,
            'info': data,
        }
    }

    async cancelOrder(id, symbol = undefined, params = {}) {
        //order.cancel
        if (symbol === undefined) {
            throw new ArgumentsRequired(this.id + ' cancelOrder() requires a `symbol` argument');
        }
        const request = {
            'market': symbol,
            'order_id': id,
        };
        const response = await this.privatePostOrderCancel(this.extend(request, params));
        const data = response.result;
        return {
            'id': data.id,
            'info': data,
        }
    }

    async cancelOrders(ids, symbol = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired(this.id + ' cancelOrders() requires a `symbol` argument');
        }
        const request = {
            'market': symbol,
            'orders_id': JSON.stringify(ids),
        };
        const response = await this.privatePostOrderBatchCancel(this.extend(request, params));
        const data = response.result;
        return data;
    }

    createSignature(params) {
        const query = [];
        for (let i in params) {
            // console.log("params", params[i])
            query.push(`${i}=` + params[i]);
        };
        const sortedQueryArray = query.sort();
        const queryString = sortedQueryArray.join('&');
        sortedQueryArray.push('secret_key=' + this.secret);
        const queryStringWithSecret = sortedQueryArray.join('&');
        const signature = this.hash(this.encode(queryStringWithSecret), 'md5').toUpperCase();
        return {
            signature,
            queryString,
        };
    }

    sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let request = '/';
        request += path;

        // console.log("params", params)
        // console.log("path", path)
        // console.log("api", api)
        // console.log("method", method)

        if (api === 'private') {
            const { signature, queryString } = this.createSignature({ ...params, api_key: this.apiKey });
            body = `${queryString}&sign=${signature}`;
            // console.log("body", body)
        } else {
            if (Object.keys(params).length) {
                request += '?' + this.urlencode(params);
            }
        }

        const url = this.urls['api'] + request;
        // console.log('url', url)
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
}