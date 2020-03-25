'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, OrderNotFound } = require('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class cointiger extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'cointiger',
            'name': 'CoinTiger',
            'countries': ['SG'],
            'rateLimit': 1000, // ????
            // 'version': 'v2',
            'has': {
                'CORS': false,
                //public
                'fetchOrderBook': true,
                'fetchTrades': true,
                'fetchMarkets': true,
                'fetchTicker': true,
                // 'fetchTickers': true,
                //private
                'fetchOrders': true,
                'fetchMyTrades': true,
                'createOrder': true,
                'cancelOrder': true,
                'fetchBalance': true,
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/28051642-56154182-660e-11e7-9b0d-6042d1e6edd8.jpg',
                'api': {
                    'tapiPrivate': 'https://api.cointiger.com/exchange/trading/api/market',
                    'mapiPublic1': 'https://www.cointiger.com/exchange/api/public/market',
                    'mapiPublic2': 'https://api.cointiger.com/exchange/trading/api/market',
                    'apiV2Private': 'https://api.cointiger.com/exchange/trading/api/v2',
                },
                'www': 'https://www.cointiger.com/en-us/#/index',
                'doc': 'https://github.com/cointiger/api-docs-en/wiki',
            },
            'api': {
                'tapiPrivate': {
                    'get': [
                        'user/balance',
                    ]
                },
                'mapiPublic1': {
                    'get': [
                        'detail',
                    ]
                },
                'mapiPublic2': {
                    'get': [
                        'history/trade',
                        'detail',
                        'history/kline',
                        'depth'
                    ]
                },
                'apiV2Private': {
                    'get': [
                        'order/orders',
                        'order/make_detail'
                    ],
                    'post': [
                        'order',
                        'order/batch_cancel',
                    ]
                }
            },
            'fees': {
                // 'trading': {
                //     'maker': 0.2 / 100,
                //     'taker': 0.2 / 100,
                // },
                // 'BTC/JPY': {
                //     'maker': 0.15 / 100,
                //     'taker': 0.15 / 100,
                // },
            },
            'apiKey': '30f52efd-8e03-4f40-9389-878d9c1a320a',
            'secret': 'OTc5NGU3MzIwMjdiYTFkMmU2OTJkYTI2NWVmNmU0NTUzZWE3ZGZmZDA0ODIyNDdmNjQ4ZGIxNWIxNmViZThhNw==',
        });
    }

    async fetchMarkets() {
        const markets = await this.mapiPublic1GetDetail();
        const result = [];
        const listOfMarkets = Object.keys(markets);

        for (let i = 0; i < listOfMarkets.length; i++) {
            const marketName = listOfMarkets[i];
            let symbol;
            let base;
            let quote;
            if (
                marketName.slice(-3) === 'BTC' ||
                marketName.slice(-3) === 'ETH' ||
                marketName.slice(-3) === 'TRX' ||
                marketName.slice(-3) === 'XRP'
            ) {
                symbol = `${marketName.slice(0, marketName.length - 3)}/${marketName.slice(-3)}`;
                base = marketName.slice(0, marketName.length - 3);
                quote = marketName.slice(-3);
            } else if (marketName.slice(-4) === 'USDT') {
                symbol = `${marketName.slice(0, marketName.length - 4)}/${marketName.slice(-4)}`;
                base = marketName.slice(0, marketName.length - 4);
                quote = marketName.slice(-4);
            } else if (marketName.slice(-5) === 'BITCNY') {
                symbol = `${marketName.slice(0, marketName.length - 5)}/${marketName.slice(-5)}`;
                base = marketName.slice(0, marketName.length - 5);
                quote = marketName.slice(-5);
            }
            markets[marketName]['id'] = marketName.toLowerCase();

            result.push({
                symbol,
                base,
                quote,
                ...markets[marketName],
            });
        }
        return result;
    }

    async fetchBalance(params = {}) {
        await this.loadMarkets();
        const request = {
            time:,
            sign:,
        };
        const response = await this.tapiPrivateGetUserBalance (params);
        // const result = { 'info': response };
        // for (let i = 0; i < response.length; i++) {
        //     const balance = response[i];
        //     const currencyId = this.safeString (balance, 'currency_code');
        //     const code = this.safeCurrencyCode (currencyId);
        //     const account = this.account ();
        //     account['total'] = this.safeFloat (balance, 'amount');
        //     account['free'] = this.safeFloat (balance, 'available');
        //     result[code] = account;
        // }
        // return this.parseBalance (result);
    }

    async fetchTicker(symbol, params = {}) {
        await this.loadMarkets();
        const request = {
            'symbol': this.marketId(symbol),
        };
        const ticker = await this.mapiPublic2GetDetail(request);
        const { data } = ticker;
        const { 
            trade_ticker_data: {
                tick,
                ts
            }
        } = data;
        const {
            amount,
            high,
            vol,
            low,
            rose,
            close,
            open,
        } = tick;
        return {
            'symbol': symbol,
            'timestamp': ts,
            'datetime': this.iso8601 (ts),
            'high': high,
            'low': low,
            'bid': undefined,
            'bidVolume': undefined,
            'ask': undefined,
            'askVolume': undefined,
            'vwap': undefined,
            'open': open,
            'close': close,
            'last': close,
            'previousClose': undefined,
            'change': rose,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': amount,
            'quoteVolume': vol,
            'info': undefined,
        };
    }

    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'symbol': market['id'],
            'size': limit ? limit : '',
        };
        const response = await this.mapiPublic2GetHistoryTrade(request);

        return this.parseTrades(response.data.trade_data, market, since, limit);
    }

    parseTrade (trade, market = undefined) {
        let side = this.safeStringLower (trade, 'side');        
        const id = this.safeString (trade, 'id');
        const timestamp = trade.ts;
        const datetime = trade.ds;
        const amount = trade.amount;
        const price = trade.price;
        // const vol = ;
        let cost = undefined;
        if (amount !== undefined) {
            if (price !== undefined) {
                cost = price * amount;
            }
        }
        let symbol = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        
        return {
            'id': id,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'order': id,
            'type': undefined,
            'side': side,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': undefined,
        };
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'symbol': this.marketId (symbol),
            'type': 'step0',
        };
        const orderbook = await this.mapiPublic2GetDepth (request);
        const timestamp = orderbook.data.depth_data.ts;
        return this.parseOrderBook (orderbook.data.depth_data.tick, timestamp, 'buys', 'asks', 0, 1);
    }


    // async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
    //     await this.loadMarkets ();
    //     const request = {
    //         'product_code': this.marketId (symbol),
    //         'child_order_type': type.toUpperCase (),
    //         'side': side.toUpperCase (),
    //         'price': price,
    //         'size': amount,
    //     };
    //     const result = await this.privatePostSendchildorder (this.extend (request, params));
    //     // { "status": - 200, "error_message": "Insufficient funds", "data": null }
    //     const id = this.safeString (result, 'child_order_acceptance_id');
    //     return {
    //         'info': result,
    //         'id': id,
    //     };
    // }

    async cancelOrder(id, symbol = undefined, params = {}) {
        // if (symbol === undefined) {
        //     throw new ArgumentsRequired (this.id + ' cancelOrder() requires a `symbol` argument');
        // }
        await this.loadMarkets();
        // const request = {
        //     'product_code': this.marketId (symbol),
        //     'child_order_acceptance_id': id,
        // };
        // return await this.privatePostCancelchildorder (this.extend (request, params));
    }

    // async fetchOrders (symbol = undefined, since = undefined, limit = 100, params = {}) {
    //     if (symbol === undefined) {
    //         throw new ArgumentsRequired (this.id + ' fetchOrders() requires a `symbol` argument');
    //     }
    //     await this.loadMarkets ();
    //     const market = this.market (symbol);
    //     const request = {
    //         'product_code': market['id'],
    //         'count': limit,
    //     };
    //     const response = await this.privateGetGetchildorders (this.extend (request, params));
    //     let orders = this.parseOrders (response, market, since, limit);
    //     if (symbol !== undefined) {
    //         orders = this.filterBy (orders, 'symbol', symbol);
    //     }
    //     return orders;
    // }

    async fetchOrder(id, symbol = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired(this.id + ' fetchOrder() requires a `symbol` argument');
        }
        const orders = await this.fetchOrders(symbol);
        // const ordersById = this.indexBy (orders, 'id');
        // if (id in ordersById) {
        //     return ordersById[id];
        // }
        // throw new OrderNotFound (this.id + ' No order found with id ' + id);
    }

    async fetchMyTrades(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired(this.id + ' fetchMyTrades requires a `symbol` argument');
        }
        await this.loadMarkets();
        // const market = this.market (symbol);
        // const request = {
        //     'product_code': market['id'],
        // };
        // if (limit !== undefined) {
        //     request['count'] = limit;
        // }
        // const response = await this.privateGetGetexecutions (this.extend (request, params));
        // return this.parseTrades (response, market, since, limit);
    }

    sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        // let request = '/' + this.version + '/';
        console.log(
            'path', path,
            'api', api,
            'method', method,
            'params', params,
        );
        //temp
        this.apiKey = '30f52efd-8e03-4f40-9389-878d9c1a320a';
        // this.secret = 'OTc5NGU3MzIwMjdiYTFkMmU2OTJkYTI2NWVmNmU0NTUzZWE3ZGZmZDA0ODIyNDdmNjQ4ZGIxNWIxNmViZThhNw==';
        let request = '/';
        request += path;
        // let symbol = 'btcbitcny'; 
        if (method === 'GET') {
            if (Object.keys(params).length) {
                const { symbol, type } = params;
                if (type) {
                    request += '?' + 'api_key=' + this.apiKey + '&' + 'symbol=' + symbol + '&' + 'type=' + type;
                } else {
                    request += '?' + 'api_key=' + this.apiKey + '&' + 'symbol=' + symbol;
                }
            }
        }

        const url = this.urls['api'][api] + request;
        console.log("HEREEEEEEE", url)

        // if (api === 'private') {
        //     this.checkRequiredCredentials ();
        //     const nonce = this.nonce ().toString ();
        //     let auth = [ nonce, method, request ].join ('');
        //     if (Object.keys (params).length) {
        //         if (method !== 'GET') {
        //             body = this.json (params);
        //             auth += body;
        //         }
        //     }
        //     headers = {
        //         'ACCESS-KEY': this.apiKey,
        //         'ACCESS-TIMESTAMP': nonce,
        //         'ACCESS-SIGN': this.hmac (this.encode (auth), this.encode (this.secret)),
        //         'Content-Type': 'application/json',
        //     };
        // }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
};
