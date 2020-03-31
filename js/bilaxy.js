'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class bilaxy extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'bilaxy',
            'name': 'Bilaxy',
            'countries': ['SC'],
            'rateLimit': 1000,
            'has': {
                'CORS': false,
                //public
                'fetchOrderBook': true,
                'fetchTrades': true,
                'fetchMarkets': true,
                'fetchTicker': true,
                'fetchTickers': true,
                //private
                'fetchOrders': true,
                'fetchMyTrades': true,
                'createOrder': true,
                'cancelOrder': true,
                'fetchBalance': true,
            },
            'headers': {
                'Language': 'en_US',
            },
            'urls': {
                'logo': 'https://avatars2.githubusercontent.com/u/58157269?s=400&u=0c535058316c0f03287519950ef5f2d61ce27093&v=4',
                'api': {
                    "public": 'https://newapi.bilaxy.com/v1',
                    "private": 'https://api.bilaxy.com/v1',
                },
                'www': 'https://bilaxy.com/',
                'doc': 'https://github.com/bilaxy-exchange/bilaxy-api-docs',
            },
            'api': {
                'public': {
                    'get': [
                        'pairs',
                        'orderbook',
                        'ticker/24hr',
                        'trades'
                    ]
                },
                'private': {
                    'get': [
                        'balances',
                        'orders',
                        'trade_list',
                    ],
                    'post': [
                        'trade',
                        'cancel_trade'
                    ],
                },
            },
        });
    }

    async fetchMarkets() {
        const response = await this.publicGetPairs();
        const result = [];
        const markets = Object.values(response);

        for (let i = 0; i < markets.length; i++) {
            let market = markets[i];
            let id = market.pair_id;
            let symbol = `${market.base}/${market.quote}`;
            let base = this.safeString (market, 'base');
            let quote = this.safeString (market, 'quote');
            let price_precision = this.safeString (market, 'price_precision');
            let amount_precision = this.safeString (market, 'amount_precision');
            let min_amount = this.safeString (market, 'min_amount');
            let max_amount = this.safeString (market, 'max_amount');
            let min_total = this.safeString (market, 'min_total');
            let max_total = this.safeString (market, 'max_total');
            const { trade_enabled, closed } = market;
            
            result.push({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'price_precision': price_precision,
                'amount_precision': amount_precision,
                'min_amount': min_amount,
                'max_amount': max_amount,
                'min_total': min_total,
                'max_total': max_total,
                'trade_enabled': trade_enabled,
                'closed': closed,
                'info': market,
            });
        }
        return result;
    }

    async fetchBalance () {
        await this.loadMarkets();
        const response = await this.privateGetBalances();
        console.log("HEREEEEEEE", response)
        const balances = this.safeValue (response, 'data');
        const result = { 'info': response };
        for (let i = 0; i < balances.length; i++) {
            const balance = balances[i];
            const currencyId = this.safeString (balance, 'name');
            const code = this.safeCurrencyCode (currencyId);
            const account = this.account ();
            account['total'] = this.safeFloat (balance, 'balance');
            account['used'] = this.safeFloat (balance, 'frozen');
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    async fetchTickers (symbol = undefined, params = {}) {
        await this.loadMarkets();
        const response = await this.publicGetTicker24hr();
        const tickers = Object.values(response);
        const symbols = Object.keys(response);
   
        return this.parseTickers(tickers, symbols);
    }

    parseTickers (tickers, symbols = undefined) {
        const result = [];
        for (let i = 0; i < tickers.length; i++) {
            result.push(this.parseTicker (tickers[i], symbols[i]));
        }
        return result;
    }

    async fetchTicker (symbol = undefined, params = {}) {
        await this.loadMarkets();
        const response = await this.publicGetTicker24hr();
        const ticker = response[symbol];
        return this.parseTicker(ticker, symbol);
    }

    parseTicker (ticker, symbol = undefined) {
        let timestamp = new Date().getTime();
        let datestamp = this.iso8601 (timestamp);
        let high = this.safeString (ticker, 'height');
        let open = this.safeString (ticker, 'open');
        let low = this.safeString (ticker, 'low');
        let close = this.safeString (ticker, 'close');
        let baseVolume = this.safeString (ticker, 'base_volume');
        let quoteVolume = this.safeString (ticker, 'quote_volume');
        let change = this.safeString (ticker, 'price_change');

        return {
            'symbol': symbol.replace('_', '/'),
            'timestamp': timestamp,
            'datetime': datestamp,
            'bid': undefined,
            'bidVolume': undefined,
            'ask': undefined,
            'askVolume': undefined,
            'vwap': undefined,
            'low': low,
            'high': high,
            'last': close,
            'open': open,
            'close': close,
            'previousClose': undefined,
            'change': change,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': baseVolume,
            'quoteVolume': quoteVolume,
            'info': ticker,
        }
    }

    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const request = {
            'pair': symbol.replace('/', '_'),
            'limit': limit ? limit : 100,
        };
        const trades = await this.publicGetTrades(this.extend(request, params));
        const result = [];
        for (let i = 0; i < trades.length; i++) {
            const trade = trades[i];
            result.push({
                ...trade,
                symbol,
            });
        }
        return this.parseTrades(result, symbol, since, limit);
    }

    parseTrade (trade, market = undefined) {
        const id = this.safeString (trade, 'id');
        const timestamp = trade.ts;
        const datetime = this.iso8601(timestamp);
        const amount = this.safeString (trade, 'amount');
        const price = this.safeString (trade, 'price');
        const cost = this.safeString (trade, 'total');
        const side = this.safeString (trade, 'direction');

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
            'cost': cost,
            'fee': undefined,
        };
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'pair': symbol.replace('/', '_'),
        };
        const orderbook = await this.publicGetOrderbook (request);
        const { timestamp } = orderbook;
        return this.parseOrderBook (orderbook, timestamp, 'bids', 'asks', 0, 1);
    }

    // async fetchOrders (symbol = undefined, since = undefined, limit = 50, params = {}) {
    //     if (symbol === undefined) {
    //         throw new ArgumentsRequired (this.id + ' fetchOrders requires a symbol argument');
    //     }
    //     await this.loadMarkets ();
    //     const market = this.market(symbol);
    //     const marketName = this.marketId(symbol)
    //     const request = {
    //         'market': marketName,
    //         'limit': limit ? limit : 50,
    //     }
    //     const response = await this.privateGetOrdersMarket(this.extend(request, params));
    //     return this.parseOrders (response.orders, market, since, limit);
    // }

    // parseOrders (orders, market = undefined, since = undefined, limit = undefined, params = {}) {
    //     let result = Object.values (orders).map (order => this.extend (this.parseOrder (order, market), params))
    //     result = this.sortBy (result, 'timestamp')
    //     return result;
    // }

    // parseOrder (order, market = undefined) {
    //     const {
    //         id,
    //         side,
    //         strategy,
    //         state,
    //     } = order;
    //     const timestamp = this.parse8601 (this.safeString (order, 'created_at'));
    //     const datetime = this.iso8601(timestamp);
    //     const symbol = this.safeString(order, 'market');  
    //     const price = this.safeFloat(order, 'price');
    //     const average = this.safeFloat(order, 'avg_price');
    //     const amount = this.safeFloat(order, 'volume');
    //     const cost = Number(order.price) * Number(order.volume);
    //     const remaining = this.safeFloat(order, 'remaining_volume');
    //     const filled = this.safeFloat(order, 'executed_volume');
    //     return {
    //         'id': id,
    //         'timestamp': timestamp,
    //         'datetime': datetime,
    //         'lastTradeTimestamp': undefined,
    //         'status': state,
    //         'symbol': symbol,
    //         'type': strategy,
    //         'side': side,
    //         'price': price,
    //         'average': average,
    //         'cost': cost,
    //         'amount': amount,
    //         'filled': filled,
    //         'remaining': remaining,
    //         'fee': undefined,
    //         'info': order,
    //     }
    // }

    // async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
    //     if (symbol === undefined) {
    //         throw new ArgumentsRequired (this.id + ' fetchMyTrades requires a `symbol` argument');
    //     }
    //     await this.loadMarkets ();
    //     const market = this.market (symbol);
    //     const request = {
    //         'market': market['id'],
    //         'limit': limit ? limit : 50,
    //     };

    //     const response = await this.privateGetTradeHistoryMarket (this.extend (request, params));
    //     return this.parseTrades (response.trades, symbol, since, limit);
    // }

    // parseTrades (trades, market = undefined, since = undefined, limit = undefined, params = {}) {
    //     let result = Object.values (trades || []).map ((trade) => this.extend (this.parseTrade (trade, market), params))
    //     result = this.sortBy (result, 'timestamp')
    //     return result;
    // }

    // parseTrade (trade, market = undefined) {
    //     const {
    //         id,
    //         side,
    //     } = trade;
    //     const timestamp = this.parse8601 (this.safeString (trade, 'timestamp'));
    //     const datetime = this.iso8601(timestamp);
    //     const symbol = market;
    //     const orderId = this.safeString(trade, 'order_id');
    //     const price = this.safeFloat(trade, 'price');
    //     const amount = this.safeFloat(trade, 'volume');
    //     const cost = this.safeFloat(trade, 'total_value');
    //     return {
    //         'id': id,
    //         'timestamp': timestamp,
    //         'datetime': datetime,
    //         'symbol': symbol,
    //         'order': orderId,
    //         'type': undefined,
    //         'side': side,
    //         'takerOrMaker': undefined,
    //         'price': price,
    //         'amount': amount,
    //         'cost': cost,
    //         'fee': undefined,
    //         'info': trade,
    //     };
    // }

    // async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
    //     await this.loadMarkets ();
    //     const request = side === 'bid' && type === 'market' 
    //         ? {
    //             'market': this.marketId(symbol),
    //             'type': side,
    //             'strategy': type,
    //             'funds': amount,
    //         }
    //         : {
    //             'market': this.marketId(symbol),
    //             'type': side,
    //             'strategy': type,
    //             'volume': amount,
    //             'price': price,
    //         };
    //     const response = await this.privatePostOrder(this.extend(request, params));
    //     const { order } = response;
    //     const { id } = order;
    //     return {
    //         'id': id,
    //         'info': response,
    //     }
    // }

    // async cancelOrder (id, symbol = undefined, params = {}) {
    //     if (symbol === undefined) {
    //         throw new ArgumentsRequired (this.id + ' cancelOrder() requires a `symbol` argument');
    //     }
    //     await this.loadMarkets ();
    //     const request = {
    //         'market': this.marketId (symbol),
    //     };
    //     return await this.privateDeleteOrdersMarket (this.extend (request, params));
    // }

    createSignature () {
        let params = [
            'secret=' + this.secret,
            'key=' + this.apiKey,
        ].join('&');
        console.log("params    ", params)
        const signature = this.hmac (this.encode (params), this.encode (this.secret), 'sha1');
        return signature;
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        console.log(
            'path', path,
            'api', api,
            'method', method,
            'params', params
        )
        let request = '/';
        request += path;
        // request += this.implodeParams (path, params);

        if (api === 'private') {
            if (method === 'GET') {
                this.apiKey = 'a3990470be5064d8882477b0f98819e88';
                this.secret = '23d802774d5b51df4a01c5831110c83b';
                const signature = this.createSignature();
                console.log("signature", signature)
                request += '?' + this.urlencode ({ key: this.apiKey, sign: signature });
                console.log("REQUEST", request)
            } else if (method === 'POST') {
                // headers = {
                //     'Content-Type': 'application/json',
                //     'Authorization': 'Bearer ' + this.apiKey,
                // }
                // if (Object.values(params).length) {
                //     body = this.json(this.createBody(params));                    
                // }
            } else {
                // headers = {
                //     'Authorization': 'Bearer ' + this.apiKey,
                // }
            }
        } else {
            if (Object.keys (params).length) {
                request += '?' + this.urlencode (params);
            }
        }

        const url = this.urls['api'][api] + request;
        console.log("url", url)
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

}