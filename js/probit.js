'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class probit extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'probit',
            'name': 'Probit',
            'countries': ['KR'],
            'rateLimit': 1000,
            'has': {
                'CORS': false,
                //public
                'fetchOrderBook': true,
                'fetchTrades': true,
                'fetchMarkets': true,
                'fetchTicker': true,
                //private
                'fetchBalance': true,
                'fetchOpenOrders': true,
                'fetchOrders': true,
                'fetchMyTrades': true,
                'createOrder': true,
                'cancelOrder': true,
            },
            'headers': {
                'Language': 'en_US',
            },
            'urls': {
                'logo': 'https://assets.coingecko.com/markets/images/370/large/IPdnUUW.png?1552380946',
                'api': { 
                    'apiPublic': 'https://api.probit.com/api/exchange/v1',
                    'apiPrivate': 'https://api.probit.com/api/exchange/v1',
                    'account': 'https://accounts.probit.com',
                },
                'www': 'https://www.probit.com/app',
                'doc': 'https://docs-en.probit.com/docs',
            },
            'api': {
                'apiPublic': {
                    'get': [
                        'market',
                        'order_book',
                        'ticker',
                        'trade'
                    ] 
                },
                'apiPrivate': {
                    'get': [
                        'open_order',//fetchOpenOrders
                        'order_history',//fetchOrders
                        'trade_history',//fetchMyTrades
                        'balance',
                    ],
                    'post': [
                        'new_order',
                        'cancel_order',
                    ],
                },
                'account': {
                    'post': [
                        'token',
                    ]
                }
            },
        });
    }
    async fetchMarkets() {
        // {
        //     id: "MONA-USDT",
        //     base_currency_id: "MONA",
        //     quote_currency_id: "USDT",
        //     min_price: "0.001",
        //     max_price: "9999999999999999",
        //     price_increment: "0.001",
        //     min_quantity: "0.0001",
        //     max_quantity: "9999999999999999",
        //     quantity_precision: 4,
        //     min_cost: "1",
        //     max_cost: "9999999999999999",
        //     cost_precision: 8,
        //     taker_fee_rate: "0.2",
        //     maker_fee_rate: "0.2",
        //     show_in_ui: true,
        //     closed: false
        //     }
        const response = await this.apiPublicGetMarket();
        const markets = response.data;
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            let market = markets[i];
            let id = market.id;
            let base = market.base_currency_id;
            let quote = market.quote_currency_id;
            let symbol = `${base}/${quote}`;

            result.push({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'min_price': market.min_price,
                'max_price': market.max_price,
                'price_increment': market.price_increment,
                'min_quantity': market.min_quantity,
                'max_quantity': market.max_quantity,
                'quantity_precision': market.quantity_precision,
                'min_cost': market.min_quantity,
                'max_cost': market.max_quantity,
                'cost_precision': market.cost_precision,
                'taker_fee_rate': market.taker_fee_rate,
                'maker_fee_rate': market.maker_fee_rate,
                'show_in_ui': market.show_in_ui,
                'closed': market.closed,
                'info': market,
            });
        }
        return result;
    }

    async fetchTicker(symbol, params = {}) {
        await this.loadMarkets();
        const request = {
            'market_ids': this.marketId(symbol),
        };
        const response = await this.apiPublicGetTicker(request);
        const ticker = response.data;
        // {
        //     last: "7346.2",
        //     low: "4770.8",
        //     high: "7680.7",
        //     change: "188.2",
        //     base_volume: "553.86065769",
        //     quote_volume: "4023118.862628775",
        //     market_id: "BTC-USDT",
        //     time: "2020-04-08T20:26:39.000Z"
        // }
        const {
            time,
            low,
            high,
            last,
            change,
            base_volume,
            quote_volume,
        } = ticker[0];
        return {
            'symbol': symbol,
            'timestamp': this.parse8601 (time),
            'datetime': time,
            'bid': undefined,
            'bidVolume': undefined,
            'ask': undefined,
            'askVolume': undefined,
            'vwap': undefined,
            'low': low,
            'high': high,
            'last': last,
            'open': undefined,
            'close': last,
            'previousClose': undefined,
            'change': change,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': base_volume,
            'quoteVolume': quote_volume,
            'info': ticker,
        };
    }

    preParseOrderBook (data) {
        const result = {
            'asks': [],
            'bids': [],
        };
        const asks = result['asks'];
        const bids = result['bids'];
        for (let i = 0; i < data.length; i++) {
            const { side } = data[i];
            if (side === 'sell') {
                bids.push(data[i]);
            } else {
                asks.push(data[i]);
            };
        }
        return result;
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'market_id': this.marketId (symbol),
        };
        const orderbook = await this.apiPublicGetOrderBook (request);
        const { data } = orderbook;
        return this.parseOrderBook (this.preParseOrderBook(data), undefined, 'bids', 'asks', 'price', 'quantity');
    }

    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchTrade requires a symbol argument');
        }
        await this.loadMarkets();
        const market = this.marketId(symbol);
        const request = {
            'market_id': market,
            'limit': limit ? limit : 100,
            'start_time': since ? this.iso8601(since) : this.iso8601(this.milliseconds () - 60000),
            'end_time': this.iso8601(this.milliseconds ()),
        };
        const response = await this.apiPublicGetTrade(request);
        const trades = response.data;
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

    // parseTrades (trades, market = undefined, since = undefined, limit = undefined, params = {}) {
    //     let result = Object.values (trades || []).map ((trade) => this.extend (this.parseTrade (trade, market), params))
    //     result = this.sortBy (result, 'timestamp')
    //     return result;
    // }

    parseTrade (trade, market = undefined) {
        const id = this.safeString (trade, 'id');
        const timestamp = this.parse8601 (this.safeString (trade, 'time'));
        const datetime = this.safeString (trade, 'time');
        const price = this.safeFloat(trade, 'price');
        const amount = this.safeFloat(trade, 'quantity');
        const side = this.safeString (trade, 'side');
        let cost = undefined;
        if (amount !== undefined) {
            if (price !== undefined) {
                cost = price * amount;
            }
        }
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
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': undefined,
        };
    }

    async fetchToken () {
        const token = await this.accountPostToken ();
        console.log("token", token);
        // this.accessToken = token.access_token;
        return token.access_token;
    }

    async fetchBalance () {
        const token = await this.fetchToken ();
        this.accessToken = token;
        const response = await this.apiPrivateGetBalance ();
        const balances = this.safeValue (response, 'data');
        const result = { 'info': response };
        if (balances.length > 0) {
            for (let i = 0; i < balances.length; i++) {
                const balance = balances[i];
                const currencyId = this.safeString (balance, 'currency');
                const code = currencyId;
                const account = this.account ();
                account['total'] = this.safeFloat (balance, 'balance');
                account['free'] = this.safeFloat (balance, 'available');
                account['used'] = this.safeFloat (balance, 'balance') - this.safeFloat (balance, 'available');
                result[code] = account;
            }
            return this.parseBalance (result);
        } else {
            return [];
        }
    }

    async fetchOrders (symbol = undefined, since = undefined, limit = 100, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOrders requires a symbol argument');
        }
        const token = await this.fetchToken ();
        this.accessToken = token;
        await this.loadMarkets ();
        const market = this.marketId(symbol);
        const request = {
            'market_id': market,
            'limit': limit ? limit : 100,
            'start_time': since ? this.iso8601(since) : this.iso8601(this.milliseconds () - 60000),
            'end_time': this.iso8601(this.milliseconds ()),
        }

        const response = await this.apiPrivateGetOrderHistory(this.extend(request, params));
        return this.parseOrders (response.data, market, since, limit);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = 50, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOpenOrders requires a symbol argument');
        }
        const token = await this.fetchToken ();
        this.accessToken = token;
        await this.loadMarkets ();
        const market = this.marketId(symbol);
        const request = {
            'market_id': market,
        }
        const response = await this.apiPrivateGetOpenOrder(this.extend(request, params));
        return this.parseOrders (response.data, market, since, limit);
    }

    parseOrders (orders, market = undefined, since = undefined, limit = undefined, params = {}) {
        let result = Object.values (orders).map (order => this.extend (this.parseOrder (order, market), params))
        result = this.sortBy (result, 'time')
        return result;
    }
    // {
    //     "id": "38173538",
    //     "user_id": "eac9ad11-...-bd8b7d0743ed",
    //     "market_id": "PROB-KRW",
    //     "type": "limit",
    //     "side": "buy",
    //     "quantity": "626.69757281",
    //     "limit_price": "103",
    //     "time_in_force": "gtc",
    //     "filled_cost": "0",
    //     "filled_quantity": "0",
    //     "open_quantity": "0",
    //     "cancelled_quantity": "626.69757281",
    //     "status": "cancelled",
    //     "time": "2019-02-01T12:52:55.659Z",
    //     "client_order_id": ""
    // }

    parseOrder (order, market = undefined) {
        const id = this.safeString(order, 'id'); 
        const timestamp = this.parse8601 (this.safeString (order, 'time'));
        const datetime = this.safeString (order, 'time');
        const symbol = this.safeString(order, 'market_id');
        const type = this.safeString(order, 'type');
        const side = this.safeString(order, 'side');
        const status = this.safeString(order, 'status');
        const amount = this.safeFloat(order, 'quantity');
        const price = this.safeFloat(order, 'limit_price');
        const cost = Number(order.limit_price) * Number(order.quantity);
        const filled = this.safeFloat(order, 'filled_quantity');
        const remaining = this.safeFloat(order, 'open_quantity');
        return {
            'id': id,
            'timestamp': timestamp,
            'datetime': datetime,
            'lastTradeTimestamp': undefined,
            'status': status,
            'symbol': symbol,
            'type': type,
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
        const token = await this.fetchToken ();
        this.accessToken = token;
        await this.loadMarkets ();
        const market = this.marketId(symbol);
        const request = {
            'market': market,
            'limit': limit ? limit : 100,
            'start_time': since ? this.iso8601(since) : this.iso8601(this.milliseconds () - 60000),
            'end_time': this.iso8601(this.milliseconds ()),
        };

        const response = await this.apiPrivateGetTradeHistory (this.extend (request, params));
        return this.parseMyTrades (response.data, market, since, limit);
    }

    parseMyTrades (trades, market = undefined, since = undefined, limit = undefined, params = {}) {
        let result = Object.values (trades || []).map ((trade) => this.extend (this.parseMyTrade (trade, market), params))
        result = this.sortBy (result, 'time')
        return result;
    }
    // {
    //     "id":"BTC-USDT:183566",
    //     "order_id":"17209376",
    //     "side":"sell",

    //     "fee_amount":"0.657396569175",
    //     "fee_currency_id":"USDT",
    
    //     "status":"settled",
    //     "price":"6573.96569175",
    //     "quantity":"0.1",
    //     "cost":"657.396569175",
    //     "time":"2018-08-10T06:06:46.000Z",
    //     "market_id":"BTC-USDT"
    //   }
    parseMyTrade (trade, market = undefined) {
        const id = this.safeString(trade, 'id'); 
        const timestamp = this.parse8601 (this.safeString (trade, 'time'));
        const datetime = this.iso8601(timestamp);
        const symbol = this.safeString(trade, 'market_id');
        const orderId = this.safeString(trade, 'order_id');
        const side = this.safeString(trade, 'side');
        const price = this.safeFloat(trade, 'price');
        const amount = this.safeFloat(trade, 'quantity');
        const cost = this.safeFloat(trade, 'cost');
        const fee = this.safeFloat(trade, 'fee_amount');
        return {
            'id': id,
            'timestamp': timestamp,
            'datetime': datetime,
            'symbol': symbol,
            'order': orderId,
            'type': undefined,
            'side': side,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
            'info': trade,
        };
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        
        const token = await this.fetchToken ();
        this.accessToken = token;
        await this.loadMarkets ();

        let request = {};
        if (type === 'market') {
            if (side === 'buy') {
                request = {
                    'market_id': this.marketId(symbol),
                    'type': type,
                    'side': side,
                    'time_in_force': 'ioc',
                    'cost': String(amount),
                }; 
            } else {
                request = {
                    'market_id': this.marketId(symbol),
                    'type': type,
                    'side': side,
                    'time_in_force': 'ioc',
                    'quantity': String(amount),
                }; 
            }
        } else if (type === 'limit') {
            request = {
                'market_id': this.marketId(symbol),
                'type': type,
                'side': side,
                'time_in_force': 'gtc',
                'price': String(price),
                'quantity': String(amount),
            }; 
        }
        
        const response = await this.apiPrivatePostNewOrder (this.extend(request, params));
        const { data } = response;
        const { id } = data;
        return {
            'id': id,
            'info': response,
        }
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' cancelOrder() requires a `symbol` and `order id` argument');
        }
        const token = await this.fetchToken ();
        this.accessToken = token;
        await this.loadMarkets ();
        const request = { 
            'market_id': this.marketId (symbol),
            'order_id': id, 
        }
        
        return await this.apiPrivatePostCancelOrder (this.extend (request, params));
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        console.log(
            'path', path,
            'api', api,
            'method', method,
            'params', params,
        )
        let request = '/';
        // request += this.implodeParams (path, params);
        request += path; 
        if (api === 'account') {
            const authHeader = 'Basic ' + this.encode (this.stringToBase64 (`${this.apiKey}:${this.secret}`));
            headers = {
                'Authorization': authHeader,
                'content-type': 'application/json',
            };
            body = this.json ({
                'grant_type': 'client_credentials',
            });
        } else if (api === 'apiPrivate') {
            if (this.accessToken) {
                headers = {
                    'Authorization': 'Bearer ' + this.accessToken,
                    'content-type': 'application/json',
                };
            }
            if (method === 'POST') {
                if (Object.keys (params).length) {
                    body = this.json (params);
                    console.log("body", body)
                }
            }
        }

        if (Object.keys (params).length) {
            request += '?' + this.urlencode (params);
        }
        const url = this.urls['api'][api] + request;
        console.log('URL', url);
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
}