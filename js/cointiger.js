'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class cointiger extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'cointiger',
            'name': 'CoinTiger',
            'countries': ['SG'],
            'rateLimit': 1000, // ????
            'has': {
                'CORS': false,
                //public
                'fetchOrderBook': true,
                'fetchTrades': true,
                'fetchMarkets': true,
                'fetchTicker': true,
                // 'fetchTickers': true,
                //private
                'fetchOpenOrders': true,
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
                'logo': 'https://user-images.githubusercontent.com/1294454/28051642-56154182-660e-11e7-9b0d-6042d1e6edd8.jpg',
                'api': {
                    'tapiPrivate': 'https://api.cointiger.com/exchange/trading/api/',
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
                        'order/make_detail',
                        'order/match_results',
                    ],
                    'post': [
                        'order',
                        'order/batch_cancel',
                    ],
                    'delete': [
                        'order',
                    ],
                }
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'maker': 0.0008,
                    'taker': 0.0015,
                },
            },
            'exceptions': {
                '1': ExchangeError,
                '2': BadRequest, // {"code":"2","msg":"Parameter error","data":null}
                '5': InvalidOrder,
                '6': InvalidOrder,
                '8': OrderNotFound,
                '16': AuthenticationError, // funding password not set
                '100001': ExchangeError,
                '100002': ExchangeNotAvailable,
                '100003': ExchangeError,
                '100005': AuthenticationError,
                '110030': DDoSProtection,
            },
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
            } else if (marketName.slice(-6) === 'BITCNY') {
                symbol = `${marketName.slice(0, marketName.length - 6)}/${marketName.slice(-6)}`;
                base = marketName.slice(0, marketName.length - 6);
                quote = marketName.slice(-6);
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
        const response = await this.tapiPrivateGetUserBalance (params);
        const balances = this.safeValue (response, 'data');
        const result = { 'info': response };
        for (let i = 0; i < balances.length; i++) {
            const balance = balances[i];
            const currencyId = this.safeString (balance, 'coin');
            const code = this.safeCurrencyCode (currencyId);
            const account = this.account ();
            account['used'] = this.safeFloat (balance, 'lock');
            account['free'] = this.safeFloat (balance, 'normal');
            const total = this.safeFloat (balance, 'normal') + this.safeFloat (balance, 'lock');
            account['total'] = total;
            result[code] = account;
        }
        return this.parseBalance (result);
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


    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        this.checkRequiredCredentials ();
        const market = this.market (symbol);
        const orderType = (type === 'limit') ? 1 : 2;
        const request = {
            'symbol': market['id'],
            'side': side.toUpperCase (),
            'type': orderType,
            'volume': this.amountToPrecision (symbol, amount),
            // 'capital_password': this.password, // obsolete since v2, https://github.com/ccxt/ccxt/issues/4815
        };
        if ((type === 'market') && (side === 'buy')) {
            if (price === undefined) {
                throw new InvalidOrder (this.id + ' createOrder requires price argument for market buy orders to calculate total cost according to exchange rules');
            }
            request['volume'] = this.amountToPrecision (symbol, parseFloat (amount) * parseFloat (price));
        }
        if (type === 'limit') {
            request['price'] = this.priceToPrecision (symbol, price);
        } else {
            if (price === undefined) {
                request['price'] = this.priceToPrecision (symbol, 0);
            } else {
                request['price'] = this.priceToPrecision (symbol, price);
            }
        }
        const response = await this.apiV2PrivatePostOrder (this.extend (request, params));
        
        const timestamp = this.milliseconds ();
        return {
            'info': response,
            'id': this.safeString (response['data'], 'order_id'),
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': undefined,
            'status': undefined,
            'symbol': symbol,
            'type': type,
            'side': side,
            'price': price,
            'amount': amount,
            'filled': undefined,
            'remaining': undefined,
            'cost': undefined,
            'trades': undefined,
            'fee': undefined,
        };
    }

    parseOrderStatus (status) {
        const statuses = {
            '0': 'open', // pending
            '1': 'open',
            '2': 'closed',
            '3': 'open',
            '4': 'canceled',
            '6': 'error',
        };
        return this.safeString (statuses, status, status);
    }

    parseOrder (order, market = undefined) {
        const id = this.safeString (order, 'id');
        let side = this.safeStringLower (order, 'side');
        let type = undefined;
        const orderType = this.safeString (order, 'type');
        let status = this.parseOrderStatus (this.safeString (order, 'status'));
        const timestamp = this.safeInteger2 (order, 'created_at', 'ctime');
        const lastTradeTimestamp = this.safeInteger2 (order, 'mtime', 'finished-at');
        let symbol = undefined;
        if (market === undefined) {
            const marketId = this.safeString (order, 'symbol');
            if (marketId in this.markets_by_id) {
                market = this.markets_by_id[marketId];
            }
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        let remaining = undefined;
        let amount = undefined;
        let filled = undefined;
        let price = undefined;
        let cost = undefined;
        let fee = undefined;
        let average = undefined;
        if (side !== undefined) {
            amount = this.safeFloat (order['volume'], 'amount');
            remaining = ('remain_volume' in order) ? this.safeFloat (order['remain_volume'], 'amount') : undefined;
            filled = ('deal_volume' in order) ? this.safeFloat (order['deal_volume'], 'amount') : undefined;
            price = ('price' in order) ? this.safeFloat (order['price'], 'amount') : undefined;
            average = ('age_price' in order) ? this.safeFloat (order['age_price'], 'amount') : undefined;
        } else {
            if (orderType !== undefined) {
                const parts = orderType.split ('-');
                side = parts[0];
                type = parts[1];
                cost = this.safeFloat (order, 'deal_money');
                price = this.safeFloat (order, 'price');
                average = this.safeFloat (order, 'avg_price');
                amount = this.safeFloat2 (order, 'amount', 'volume');
                filled = this.safeFloat (order, 'deal_volume');
                const feeCost = this.safeFloat (order, 'fee');
                if (feeCost !== undefined) {
                    let feeCurrency = undefined;
                    if (market !== undefined) {
                        if (side === 'buy') {
                            feeCurrency = market['base'];
                        } else if (side === 'sell') {
                            feeCurrency = market['quote'];
                        }
                    }
                    fee = {
                        'cost': feeCost,
                        'currency': feeCurrency,
                    };
                }
            }
        }
        if (amount !== undefined) {
            if (remaining !== undefined) {
                if (filled === undefined) {
                    filled = Math.max (0, amount - remaining);
                }
            } else if (filled !== undefined) {
                cost = filled * price;
                if (remaining === undefined) {
                    remaining = Math.max (0, amount - filled);
                }
            }
        }
        if (status === undefined) {
            if (remaining !== undefined) {
                if (remaining === 0) {
                    status = 'closed';
                }
            }
        }
        const result = {
            'info': order,
            'id': id,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': lastTradeTimestamp,
            'symbol': symbol,
            'type': type,
            'side': side,
            'price': price,
            'average': average,
            'cost': cost,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'status': status,
            'fee': fee,
            'trades': undefined,
        };
        return result;
    }

    async cancelOrder (ids, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' cancelOrder requires a symbol argument');
        }
        const market = this.market (symbol);
        const marketId = market['id'];
        const orderIdList = {};
        orderIdList[marketId] = typeof ids === 'string' ? [ ids ] : ids;
        const request = {
            'orderIdList': this.json (orderIdList),
        };
        const response = await this.apiV2PrivatePostOrderBatchCancel (this.extend (request, params));
        return {
            'info': response,
        };
    }
    
    async fetchOrders (symbol = undefined, since = undefined, limit = 100, params = {}) {
        return await this.fetchOrdersByStatesV2 ('new,part_filled,filled,canceled,expired', symbol, since, limit, params);
    }

    async fetchOrdersByStatesV2 (states, symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOrders requires a symbol argument');
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        if (limit === undefined) {
            limit = 50;
        }
        const request = {
            'symbol': market['id'],
            // 'types': 'buy-market,sell-market,buy-limit,sell-limit',
            'states': states, // 'new,part_filled,filled,canceled,expired'
            // 'from': '0', // id
            'direct': 'next', // or 'prev'
            'size': limit,
        };
        const response = await this.apiV2PrivateGetOrderOrders (this.extend (request, params));
        return this.parseOrders (response['data'], market, since, limit);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        return await this.fetchOrdersByStatesV2 ('new,part_filled', symbol, since, limit, params);
    }

    async fetchMyTrades(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        const week = 604800000; // milliseconds
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchMyTrades requires a symbol argument');
        }
        if (since === undefined) {
            since = this.milliseconds () - week; // week ago
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        const start = this.ymd (since);
        const end = this.ymd (this.sum (since, week)); // one week
        if (limit === undefined) {
            limit = 1000;
        }
        const request = {
            'symbol': market['id'],
            'start-date': start,
            'end-date': end,
            'size': limit,
        };
        const response = await this.apiV2PrivateGetOrderMatchResults (this.extend (request, params));
        return this.parseTrades (response['data'], market, since, limit);
    }

    sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        this.checkRequiredCredentials ();
        let request = '/';
        request += path;
        console.log('params', params)
        if (api === 'tapiPrivate' || api === 'apiV2Private') {
            const timestamp = this.milliseconds ().toString ();
            const query = this.keysort (this.extend ({
                'time': timestamp,
            }, params));
            const keys = Object.keys (query);
            let auth = '';
            for (let i = 0; i < keys.length; i++) {
                auth += keys[i] + query[keys[i]].toString ();
            }
            auth += this.secret;
            const signature = this.hmac (this.encode (auth), this.encode (this.secret), 'sha512');
            const urlParams = method === 'POST' ? {} : query;
            request += '?' + this.urlencode (this.keysort (this.extend ({
                'api_key': this.apiKey,
                'time': timestamp,
            }, urlParams)));
            request += '&sign=' + signature;
            if (method === 'POST') {
                body = this.urlencode (query);
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                };
            }
        } else if (api === 'mapiPublic1' || api === 'mapiPublic2') {
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
        }

        const url = this.urls['api'][api] + request;
        console.log("URL", url)
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
};
