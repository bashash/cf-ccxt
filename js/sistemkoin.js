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

    async fetchBalance(symbol) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchBalance requires a symbol argument');
        }
        const response = await this.privateGetAccountBalance();
        const balance = this.safeValue (response, 'data');
        const result = { 'info': response };
        const currencyId = this.safeString (balance, 'currency');
        const code = this.safeCurrencyCode (currencyId);
        const account = this.account ();
        account['total'] = this.safeFloat (balance, 'amount');
        account['used'] = this.safeFloat (balance, 'reservedAmount');
        account['lending'] = this.safeFloat (balance, 'lendingAmount');
        result[code] = account;

        return this.parseBalance (result);
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