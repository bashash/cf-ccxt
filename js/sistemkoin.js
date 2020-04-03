'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class sistemkoin extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'sistemkoin',
            'name': 'Sistemkoin',
            'countries': ['TR'],
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
                'logo': 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/388.png',
                'api': {
                        'public': 'https://api.sistemkoin.com',
                        'private': 'https://api.sistemkoin.com/api/v1',
                    },
                'www': 'https://sistemkoin.com/',
                'doc': 'https://github.com/sistemkoin-exchange/sistemkoin-official-api-docs',
            },
            'api': {
                'public': {
                    'get': [
                        'orderbook',
                        'ticker',
                    ]
                },
                'private': {
                    'get': [
                        'account/orders',
                        'account/trades',
                        'account/balance',
                        'market/pairs',
                        'market/ticker',
                        'trade',
                    ],
                    'post': [
                        'market'
                    ],
                    'delete': [
                        'market',
                    ]
                },
            },
        });
    }

    async fetchMarkets() {
        const response = await this.privateGetMarketPairs();
        const markets = response.data;
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            let market = markets[i];
            let id = market.id;
            let base = this.safeString(market, 'coinSymbol');
            let quote = this.safeString(market, 'pairCoinSymbol');
            let symbol = `${base}/${quote}`;

            result.push({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'numberOfDigitsCoin': market.numberOfDigitsCoin,
                'numberOfDigitsPairCoin': market.numberOfDigitsPairCoin,
                'changeValue': market.changeValue,
                'change': market.change,
                'changeDirection': market.changeDirection,
                'info': market,
            });
        }
        return result;
    }

    async fetchTickers (symbol = undefined, params = {}) {
        // await this.loadMarkets();
        const response = await this.publicGetTicker();
        
        let dataArray = Object.values(response);
        let quoteSymbolsArray = Object.keys(response);
        const symbols = [];
        const tickers = [];
        
        for (let i = 0; i < dataArray.length; i += 1) {
            let quote = quoteSymbolsArray[i];
            for (let j = 0; j < Object.values(dataArray[i]).length; j += 1) {
                let base = Object.keys(dataArray[i])[j];
                let marketPair = `${base}/${quote}`;
                symbols.push(marketPair);
                tickers.push({
                    market: marketPair,
                    ...Object.values(dataArray[i])[j]
                }); 
            }    
        }

        return this.parseTickers(tickers, symbols);
    }

    parseTickers (tickers, symbols = undefined) {
        const result = [];
        for (let i = 0; i < tickers.length; i++) {
            result.push(this.parseTicker (tickers[i], symbols[i]));
        }
        return result;
    }

    parseTicker (ticker, symbol = undefined) {
        console.log(ticker, symbol)
        let timestamp = this.milliseconds ();
        let datestamp = this.iso8601 (timestamp);
        let ask = this.safeString (ticker, 'askPrice');
        let bid = this.safeString (ticker, 'bidPrice');
        let high = this.safeString (ticker, 'high');
        let low = this.safeString (ticker, 'low');
        let baseVolume = this.safeString (ticker, 'volume');
        let change = this.safeString (ticker, 'change');
        let percentage = this.safeString (ticker, 'changePercentage');

        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': datestamp,
            'bid': bid,
            'bidVolume': undefined,
            'ask': ask,
            'askVolume': undefined,
            'vwap': undefined,
            'low': low,
            'high': high,
            'last': undefined,
            'open': undefined,
            'close': undefined,
            'previousClose': undefined,
            'change': change,
            'percentage': percentage,
            'average': undefined,
            'baseVolume': baseVolume,
            'quoteVolume': undefined,
            'info': ticker,
        }
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        // await this.loadMarkets ();
        const request = {
            'symbol': symbol,
            'limit': limit ? limit : 10,
        };
        const orderbook = await this.publicGetOrderbook (request);
        const { timestamp } = orderbook;
        return this.parseOrderBook (orderbook, timestamp, 'bids', 'asks', 0, 1);
    }

    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        // await this.loadMarkets();
        // const market = this.marketId(symbol);
        const request = {
            'symbol': symbol,
            'limit': limit ? limit : 10,
        };
        const response = await this.privateGetTrade(request);
        const trades = response.data;
        console.log(trades)
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

        // {
        //     "price": "49000.00000000",
        //     "volume": "1.00000000",
        //     "funds": "49000.00000000",
        //     "side": "bid",
        //     "timestamp": 1577099182
        //   }
    parseTrade (trade, market = undefined) {
        // const id = this.safeString (trade, 'id');
        const timestamp = trade.timestamp;
        const datetime = this.iso8601(timestamp * 1000);
        const price = this.safeFloat(trade, 'price');
        const amount = this.safeFloat(trade, 'volume');
        const side = this.safeString(trade, 'side');
        let cost = undefined;
        if (amount !== undefined) {
            if (price !== undefined) {
                cost = price * amount;
            }
        }
        return {
            'id': undefined,
            'info': trade,
            'timestamp': timestamp,
            'datetime': datetime,
            'symbol': market,
            'order': undefined,
            'type': undefined,
            'side': side,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': undefined,
        };
    }

    async fetchBalance (symbol) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchBalance requires a symbol argument');
        }
        const request = {
            'symbol': symbol,
            'timestamp': this.nonce(),
        };
        const response = await this.privateGetAccountBalance(request);
        const balance = this.safeValue (response, 'data');
        const result = { 'info': response };
        const currencyId = this.safeString (balance, 'currency');
        const code = this.safeCurrencyCode (currencyId ? currencyId : symbol);
        const account = this.account ();
        account['total'] = this.safeFloat (balance, 'amount');
        account['used'] = this.safeFloat (balance, 'reservedAmount');
        account['lending'] = this.safeFloat (balance, 'lendingAmount');
        result[code] = account;

        return this.parseBalance (result);
    }

    async fetchOrders (symbol = undefined, since = undefined, limit = 50, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOrders requires a symbol argument');
        }
        const request = {
            'symbol': symbol,
        }
        const response = await this.privateGetAccountOrders(this.extend(request, params));
        return this.parseOrders (response.orders, market, since, limit);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = 50, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOrders requires a symbol argument');
        }
        const request = {
            'symbol': symbol,
            'status': 'PENDING',
        }
 
        const response = await this.privateGetAccountOrders(this.extend(request, params));
        return this.parseOrders (response.orders, market, since, limit);
    }

    parseOrders (orders, market = undefined, since = undefined, limit = undefined, params = {}) {
        let result = Object.values (orders).map (order => this.extend (this.parseOrder (order, market), params))
        // result = this.sortBy (result, 'timestamp')
        return result;
    }
    // "id": 10000
    //  "coin": "BTC"
    //  "pairCoin": "TRY"
    //  "pair": "BTCTRY"
    //  "average": "70010.00000000"
    //  "triggerPrice": "70010.00000000"
    //  "remainingAmount": "0.24583160"
    //  "amount": "1.00000000"
    //  "orderStatus": "PENDING"
    //  "coinPrecision": 8
    //  "pairCoinPrecision": 2
    //  "isActive": true
    parseOrder (order, market = undefined) {
        const {
            id,
        } = order;
        const timestamp = undefined;
        const datetime = undefined;
        const symbol = this.safeString(order, 'pair');  
        const status = this.safetString(order, 'orderStatus');
        const price = this.safeFloat(order, 'triggerPrice');
        const average = this.safeFloat(order, 'average');
        const amount = this.safeFloat(order, 'amount');
        const cost = Number(order.triggerPrice) * Number(order.amount);
        const remaining = this.safeFloat(order, 'remainingAmount');
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
            'average': average,
            'cost': cost,
            'amount': amount,
            'filled': undefined,
            'remaining': remaining,
            'fee': undefined,
            'info': order,
        }
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchMyTrades requires a `symbol` argument');
        }
        const request = {
            // 'symbol': symbol,
            // 'limit': limit ? limit : 50,
            // 'since': since ? since : '',
        };
        const response = await this.privateGetAccountTrades (this.extend (request, params));
        return this.parseMyTrades (response.data, symbol, since, limit);
    }
    
    parseMyTrades (trades, market = undefined, since = undefined, limit = undefined, params = {}) {
        let result = Object.values (trades || []).map ((trade) => this.extend (this.parseMyTrade (trade, market), params))
        // result = this.sortBy (result, 'timestamp')
        return result;
    }
    // "id": 2627
    // "coin": "XVG"
    // "pairCoin": "EUR"
    // "pair": "XVGEUR"
    // "amount": "1000.00000000"
    // "price": "0.12300000"
    // "coinPrecision": 2
    // "pairCoinPrecision": 6
    // "isActive": true
    parseMyTrade (trade, market = undefined) {
        const {
            id,
        } = trade;
        const timestamp = undefined;
        const datetime = undefined;
        const symbol = this.safeString(trade, 'pair');;
        // const orderId = this.safeString(trade, 'order_id');
        const price = this.safeFloat(trade, 'price');
        const amount = this.safeFloat(trade, 'amount');
        // const cost = this.safeFloat(trade, 'total_value');
        return {
            'id': id,
            'timestamp': timestamp,
            'datetime': datetime,
            'symbol': symbol,
            'order': id,
            'type': undefined,
            'side': undefined,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': undefined,
            'fee': undefined,
            'info': trade,
        };
    }

    async createOrder (symbol, type = undefined, side, amount, price = undefined, params = {}) {
        const request =  {
            'market': symbol,
            'type': side.toUppercase(),
            'amount': amount,
            'price': price,
            'recvWindow': recvWindow ? recvWindow : 5000,
            'timestamp': this.nonce(),
        }
        const response = await this.privatePostMarket(this.extend(request, params));
        const { data } = response;
        const { orderID } = data;
        return {
            'id': orderID,
            'info': response,
        }
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        if (id === undefined) {
            throw new ArgumentsRequired (this.id + ' cancelOrder() requires a `id` argument');
        }
        const request = { 
            "orderID": id,
        }
        return await this.privateDeleteMarket (this.extend (request, params));
    }

    createSignature (params) {
        const query = [];
        for (let i in params) {
            query.push(`${i}=` + params[i]);
        };
        const queryString = query.join('&');
        const signature = this.hmac (this.encode (queryString), this.encode (this.secret), 'sha256', 'hex');
        return { 
            signature, 
            queryString,  
        };
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let request = '/';
        request += path;
        if (api === 'private') {
            headers = {
                'X-STK-ApiKey': this.apiKey,
            };
            if (path === 'account/balance' || path === 'market') {
                const { signature, queryString } = this.createSignature(params);
                request += `?${queryString}&signature=${signature}`;
            } else {
                if (Object.keys (params).length) {
                    request += '?' + this.urlencode (params);
                }
            };
        } else {
            if (Object.keys (params).length) {
                request += '?' + this.urlencode (params);
            }
        }
        const url = this.urls['api'][api] + request;
        console.log("URL", url)
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
}