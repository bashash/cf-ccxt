'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class tokenznet extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'tokensnet',
            'name': 'Tokens.net',
            'countries': ['UK'],
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
                'logo': 'https://www.tokens.net/static/img/logo-white.svg',
                'api': 'https://api.tokens.net',
                'www': 'https://www.tokens.net',
                'doc': 'https://www.tokens.net/api',
            },
            'api': {
                'public': {
                    'get': [
                        'public/trading-pairs/get/all/',
                        'public/order-book/{tradingPair}/',
                        'public/ticker/{tradingPair}/',
                        'public/trades/day/{tradingPair}/'
                    ]
                },
                'private': {
                    'get': [
                        'private/balance/all/',
                        'private/orders/get/{tradingPair}/',
                        'private/trades/{tradingPair}/{page}/',
                    ],
                    'post': [
                        'private/orders/add/limit/',
                        'private/orders/cancel/{orderId}/'
                    ],
                },
            },
        });
    }

    async fetchMarkets() {
        const response = await this.publicGetPublicTradingPairsGetAll();
        const result = [];
        const markets = Object.values(response);

        for (let i = 0; i < markets.length; i++) {
            let market = markets[i];
            let id = market.id;
            let symbol = market.title;
            let base = this.safeString (market, 'baseCurrency');
            let quote = this.safeString (market, 'counterCurrency');
            let minAmount = this.safeString (market, 'minAmount');

            result.push({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'amountDecimals': market.amountDecimals,
                'priceDecimals': market.priceDecimals,
                'minAmount': minAmount,
                'info': market,
            });
        }

        return result;
    }

    async fetchTicker (symbol = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market (symbol);
        const tradingPair = `${market.base}${market.quote}`; 
        const request = {
            'tradingPair': tradingPair,
        };
        const response = await this.publicGetPublicTickerTradingPair(this.extend(request, params));
        return this.parseTicker (response, symbol);
    }

    parseTicker (ticker, symbol = undefined) {
        let timestamp = ticker.timestamp;
        let datestamp = this.iso8601 (timestamp);
        let bid = this.safeString (ticker, 'bid');;
        let ask = this.safeString (ticker, 'ask');;
        let last = this.safeString (ticker, 'last');
        let high = this.safeString (ticker, 'high');
        let low = this.safeString (ticker, 'low');
        let open = this.safeString (ticker, 'open');
        let quoteVolume = this.safeString (ticker, 'volume');
        let vwap = this.safeString (ticker, 'vwap');

        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': datestamp,
            'bid': bid,
            'bidVolume': undefined,
            'ask': ask,
            'askVolume': undefined,
            'vwap': undefined,//vwap
            'low': low,
            'high': high,
            'last': last,
            'open': open,
            'close': last,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': undefined,
            'quoteVolume': quoteVolume,
            'info': ticker,
        }
    }

    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market (symbol);
        const tradingPair = `${market.base}${market.quote}`; 
        const request = {
            'tradingPair': tradingPair,
        };
        const response = await this.publicGetPublicTradesDayTradingPair(this.extend(request, params));
        const { trades } = response;
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
        const timestamp = trade.datetime * 1000;
        const datetime = this.iso8601(timestamp);
        const amount = this.safeString (trade, 'amount');
        const price = this.safeString (trade, 'price');
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
            'cost': undefined,
            'fee': undefined,
        };
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const tradingPair = `${market.base}${market.quote}`;
        const request = {
            'tradingPair': tradingPair,
        };
        const orderbook = await this.publicGetPublicOrderBookTradingPair(this.extend(request, params));
        const timestamp = orderbook.timestamp * 1000;
        return this.parseOrderBook (orderbook, timestamp, 'bids', 'asks', 0, 1);
    }

    sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        console.log(
            'path', path,
            'api', api,
            'method', method,
            'params', params
        )
        let request = '/';
        request += this.implodeParams (path, params);
        const url = this.urls['api'] + request;
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
}