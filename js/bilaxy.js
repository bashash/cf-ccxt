'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection } = require ('./base/errors');
const CryptoJS = require ('./static_dependencies/crypto-js/crypto-js');
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
                    "oldprivate": 'https://api.bilaxy.com/v1',
                    "private": 'https://newapi.bilaxy.com/v1',
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
                        'accounts/balances',
                        'accounts/orders',
                        'accounts/orders/opened',
                        'accounts/trades'
                    ],
                    // 'post': [
                    //     'trade',
                    //     'cancel_trade'
                    // ],
                },
                'oldprivate': {
                    'get': [
                        'balances',//old api endpoint. deprecated
                        'trade_list',//old api endpoint. deprecated
                        'trade_view',//old api endpoint. deprecated
                    ],
                    'post': [
                        'trade',
                        'cancel_trade'
                    ],
                }
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
        // const response = await this.privateGetBalances();
        // {
        //     "BTC": {
        //       "available": 0.3851212,
        //       "used": 0
        //     },
        //     "ETH": {
        //       "available": 0.12,
        //       "used": 0.346
        //     },
        //     "USDT": {
        //       "available": 39.289,
        //       "used": 0
        //     }
        //   }
        const response = await this.privateGetAccountsBalances();
        // console.log("fetchBalance", response)
        // const balances = this.safeValue (response, 'data');
        const balances = Object.entries(response);
        const result = { 'info': response };
        for (let i = 0; i < balances.length; i++) {
            const currency = balances[i][0];
            const balance = balances[i][1];
            const code = this.safeCurrencyCode (currency);
            const account = this.account ();
            account['free'] = this.safeFloat (balance, 'available');
            account['used'] = this.safeFloat (balance, 'used');
            const total = this.safeFloat (balance, 'available') + this.safeFloat (balance, 'used');
            account['total'] = total;
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
        const ticker = response[symbol.replace('/', '_')];
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

    async fetchOrders (symbol = undefined, since = undefined, limit = 100, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOrders requires a symbol argument');
        }
        await this.loadMarkets ();
        const market = this.market(symbol);
        const id = this.marketId(symbol);
        // const request = {
        //     'symbol': id,
        //     'since': since ? since : 0,
        //     // 'type': 0,
        // }
        // const response = await this.privateGetTradeList(this.extend(request, params));
        // new endpoint 'accounts/orders'
        // console.log('market', market);
        // const timestamp = new Date().getTime();
        const pair = market.base + '_' + market.quote;
        const request = {
            pair: pair,
            limit: limit,
        };
        // console.log('request', request)
        const response = await this.privateGetAccountsOrders(this.extend(request, params));
        return this.parseOrders (response, market, since, limit);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = 100, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOrders requires a symbol argument');
        }
        await this.loadMarkets ();
        const market = this.market(symbol);
        const id = this.marketId(symbol);
        const pair = market.base + '_' + market.quote;
        const request = {
            'pair': pair,
            // 'since': since ? since : 0,
            // 'type': 1,
        }
        // const response = await this.privateGetTradeList(this.extend(request, params));
        // accounts/orders/opened
        const response = await this.privateGetAccountsOrdersOpened(this.extend(request, params));
        // [ {
        //     "id": 4141252871,
        //     "price": 6998,
        //     "amount": 0.71327,
        //     "total": 4991.46346,
        //     "filled_total": 0,
        //     "created_at": "2020-04-06T13:57:03Z",
        //     "pair_name": "BTC_USDT",
        //     "direction": "sell",
        //     "filled_amount": 0,
        //     "state": "non-filled"
        //   }, .. ]
        return this.parseOrders (response, market, since, limit);
    }

    parseOrders (orders, market = undefined, since = undefined, limit = undefined, params = {}) {
        let result = Object.values (orders).map (order => this.extend (this.parseOrder (order, market), params))
        result = this.sortBy (result, 'timestamp')
        return result;
    }

    parseOrderStatus (status) {
        const statuses = {
            1: 'open',
            2: 'pending',
            3: 'closed',
            4: 'canceled',
        };
        return statuses[status];
    }

    parseOrder (order, market = undefined) {
        // {
        //     "id": 4141252868,
        //     "price": 7012.5,
        //     "amount": 0.008939,
        //     "total": 62.6847375,
        //     "filled_total": 0,
        //     "created_at": "2020-04-06T13:56:55Z",
        //     "pair_name": "BTC_USDT",
        //     "direction": "sell",
        //     "filled_amount": 0,
        //     "state": "canceled"
        //   },
        const { id } = order;
        const timestamp = new Date(this.safeString (order, 'created_at')).getTime();
        const datetime = this.iso8601(timestamp);
        const symbol = market;
        // const status = this.parseOrderStatus(order.state);
        const status = this.safeString(order, 'state');
        const price = this.safeFloat(order, 'price');
        const side = this.safeString(order, 'direction');
        const amount = this.safeFloat(order, 'amount');
        const cost = this.safeFloat(order, 'total');
        const filled = this.safeFloat(order, 'filled_total');
        const remaining = Number(amount) - Number(filled);

        return {
            'id': id,
            'timestamp': timestamp,
            'datetime': datetime,
            'lastTradeTimestamp': undefined,
            'status': status,
            'symbol': symbol,
            'type': undefined,
            'side': side,
            'price': price,
            'average': undefined,
            'cost': cost,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'fee': undefined,
            'info': order,
        }
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchMyTrades requires a `symbol` argument');
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        // console.log("market", market)
        const pair = market.base + '_' + market.quote;
        const request = {
            'pair': pair,
            'limit': limit ? limit : 100,
            'end': since ? since : new Date().getTime() - 24 * 60 * 60 * 1000 * 10,//10 days before now
        };

        // const response = await this.privateGetTradeView (this.extend (request, params));
        const response = await this.privateGetAccountsTrades (this.extend (request, params));
        return this.parseMyTrades (response, symbol, since, limit);
    }

    parseMyTrades (trades, market = undefined, since = undefined, limit = undefined, params = {}) {
        let result = Object.values (trades || []).map ((trade) => this.extend (this.parseMyTrade (trade, market), params))
        result = this.sortBy (result, 'timestamp')
        return result;
    }

    parseMyTrade (trade, market = undefined) {
        // {
        //     "id": 716797287,
        //     "order_id": 4141266876,
        //     "total": 0.0345,
        //     "price": 0.0000345,
        //     "amount": 1000,
        //     "created_at": "2020-04-10T19:00:14Z",
        //     "role": "taker",
        //     "direction": "buy",
        //     "pair": "BIA_ETH",
        //     "fees": 0.96189591,
        //     "fees_currency": "BIA"
        //   },
        const id = this.safeString(trade, 'id');
        const timestamp = this.parse8601 (this.safeString (trade, 'created_at'));
        const datetime = this.iso8601(timestamp);
        const symbol = market;
        const orderId = this.safeString(trade, 'id');
        const price = this.safeFloat(trade, 'price');
        const amount = this.safeFloat(trade, 'amount');
        const cost = this.safeFloat(trade, 'total');
        const fee = this.safeFloat(trade, 'fees');
        const side = this.sageString(trade, 'direction');
        const takeOrMaker = this.safeString(trade, 'role');

        return {
            'id': id,
            'timestamp': timestamp,
            'datetime': datetime,
            'symbol': symbol,
            'order': orderId,
            'type': undefined,
            'side': side,
            'takerOrMaker': takeOrMaker,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
            'info': trade,
        };
    }

    async createOrder (symbol, type = 'limit', side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        const id = this.marketId(symbol);
        const request = {
            'symbol': id,
            'amount': amount,
            'price': price,
            'type': side,
        }

        const response = await this.oldprivatePostTrade(this.extend(request, params));
        const { data } = response;
        return {
            'id': data,
            'info': response,
        }
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        // if (symbol === undefined) {
        //     throw new ArgumentsRequired (this.id + ' cancelOrder() requires a `symbol` argument');
        // }
        await this.loadMarkets ();
        const request = {
            'id': id,
        };
        return await this.oldprivatePostCancelTrade (this.extend (request, params));
    }

    sha1 (request, secret, hash = 'sha256', digest = 'hex') {
        const result = CryptoJS[hash.toUpperCase()](request, secret)
        if (digest) {
            const encoding = (digest === 'binary') ? 'Latin1' : digest.toUpperCase()
            return result.toString(CryptoJS.enc[encoding.toUpperCase()])
        }
        return result
    }

    createSignatureOldApi (input) {
        const params = [];
        for (let i in input) {
            params.push(`${i}=` + input[i]);   
        };
        const message = params.sort().join('&');
        const signature = this.sha1 (this.encode (message), this.encode (this.secret), 'sha1');
        return signature;
    }

    createSignature (params) {
        const query = [];        
        for (let i in params) {
            query.push(`${i}=` + params[i]);
        };
        const queryString = query.sort().join('&');
        const signature = this.hmac (this.encode (queryString), this.encode (this.secret), 'sha256', 'hex');
        return signature;
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let request = '/';
        request += path;

        if (api === 'private') {
            // const signature = this.createSignature({ ...params, key: this.apiKey, secret: this.secret });
            // request += '?' + this.urlencode ({ ...params, key: this.apiKey, sign: signature });
            const timestamp = new Date().getTime();
            const signature = this.createSignature({ ...params, apikey: this.apiKey, timestamp: timestamp });
            request += '?' + this.urlencode ({ ...params, apikey: this.apiKey, signature: signature, timestamp: timestamp });
        } else if (api === 'oldprivate') {
            const signature = this.createSignature({ ...params, key: this.apiKey, secret: this.secret });
            request += '?' + this.urlencode ({ ...params, key: this.apiKey, sign: signature });
        } else {
            if (Object.keys (params).length) {
                request += '?' + this.urlencode (params);
            }
        }

        const url = this.urls['api'][api] + request;
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

}