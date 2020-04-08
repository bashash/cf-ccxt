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
                'api': 'https://api.probit.com/api/exchange/v1',
                'www': 'https://www.probit.com/app',
                'doc': 'https://docs-en.probit.com/docs',
            },
            'api': {
                'public': {
                    'get': [
                        'market',
                        'order_book',
                        'ticker',
                        'trade'
                    ]
                },
                'private': {
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
        const response = await this.publicGetMarket();
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
        const response = await this.publicGetTicker(request);
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
        const orderbook = await this.publicGetOrderbook (request);
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
        const response = await this.publicGetTrade(request);
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
        const timestamp = this.parse8601 (this.safeString (trade, 'timestamp'));
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


    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let request = '/';
        // request += this.implodeParams (path, params);
        request += path;
        if (Object.keys (params).length) {
            request += '?' + this.urlencode (params);
        }
        const url = this.urls['api'] + request;
        console.log('URL', url);
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
}