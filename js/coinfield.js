'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class coinfield extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'coinfield',
            'name': 'CoinField',
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
                // 'fetchOHLCV': false,
                //private
                // 'fetchOrders': true,
                // 'fetchMyTrades': true,
                // 'createOrder': true,
                // 'cancelOrder': true,
                'fetchBalance': true,
            },
            'headers': {
                'Language': 'en_US',
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/28051642-56154182-660e-11e7-9b0d-6042d1e6edd8.jpg',
                'api': 'https://api.test.coinselect.com/v1',
                'www': 'https://www.coinfield.com/',
                'doc': 'https://api.coinfield.com/v1/docs/',
            },
            'api': {
                'public': {
                    'get': [
                        'markets',
                        'orderbook/{market}',
                        'tickers/{market}',
                        'trades/{market}'
                    ]
                },
                'private': {
                    'get': [
                        'orders/{market}',
                        'trade-history/{market}',
                        'wallets',
                    ],
                    'post': [
                        'order'
                    ],
                    'delete': [
                        'orders/{market}',
                    ]
                },
            },
            'fees': {
                // 'trading': {
                //     'tierBased': false,
                //     'percentage': true,
                //     'maker': 0.0008,
                //     'taker': 0.0015,
                // },
            },
        });
    }

    async fetchMarkets() {
        const response = await this.publicGetMarkets();
        const markets = response.markets;
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            let market = markets[i];
            let id = market.id;
            let symbol = market.name;
            let base = market.ask_unit;
            let quote = market.bid_unit;

            result.push({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'ask_precision': market.ask_precision,
                'bid_precision': market.bid_precision,
                'minimum_volume': market.minimum_volume,
                'maximum_volume': market.maximum_volume,
                'minimum_funds': market.minimum_funds,
                'maximum_funds': market.maximum_funds,
                'minimum_level': markets.minimum_level,
                'restricted_countries': markets.restricted_countries,
                'info': market,
            });
        }
        return result;
    }

    async fetchBalance(params = {}) {
        await this.loadMarkets();
        const response = await this.privateGetWallets();
        const balances = this.safeValue (response, 'wallets');
        for (let i = 0; i < balances.length; i++) {
            const balance = balances[i];
            const currencyId = this.safeString (balance, 'currency');
            const code = this.safeCurrencyCode (currencyId);
            const account = this.account ();
            account['total'] = this.safeFloat (balance, 'balance');
            account['used'] = this.safeFloat (balance, 'locked');
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    async fetchTicker(symbol, params = {}) {
        await this.loadMarkets();
        const request = {
            'market': this.marketId(symbol),
        };
        const response = await this.publicGetTickersMarket(request);
        const ticker = response.markets;
        const {
            timestamp,
            bid,
            ask,
            low,
            high,
            last,
            open,
            vol,
        } = ticker[0];
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': timestamp,
            'bid': bid,
            'bidVolume': undefined,
            'ask': ask,
            'askVolume': undefined,
            'vwap': undefined,
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
            'quoteVolume': vol,
            'info': ticker,
        };
    }

    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.marketId(symbol);
        const request = {
            'market': market,
            // 'limit': limit ? limit : '',
            // 'symbol': market['id'],
        };
        const response = await this.publicGetTradesMarket(request);
        const trades = response.trades;
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
        const timestamp = new Date(trade.timestamp).getTime();
        const datetime = this.iso8601(timestamp);
        const amount = trade.volume;
        const price = trade.price;
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
            'side': undefined,
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
            'market': this.marketId (symbol),
            // 'type': 'step0',
        };
        const orderbook = await this.publicGetOrderbookMarket (request);
        const { timestamp } = orderbook;
        return this.parseOrderBook (orderbook, timestamp, 'bids', 'asks', 'price', 'volume');
    }

    sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        console.log(
            'path', path,
            'api', api,
            'params', params,
            this.implodeParams (path, params)
        )
        let request = '/';
        request += this.implodeParams (path, params);
        // if (api === 'public') {
        //     if (method === 'GET') {
        //         if (Object.keys(params).length) {
        //             const { limit, timestamp, from, order_by} = params;
        //             // request += '?' +
        //         }
        //     }
        // } else 
        if (api === 'private') {
            // const jwt = this.jwt (request, this.encode (this.secret));
            this.apiKey = 'eyJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE1ODUxNzg5ODEsImV4cCI6MTU4NTI2NTMzOCwic3ViIjoic2Vzc2lvbiIsImlzcyI6InVhYyIsInNjcCI6WyJvcmRlcnMiXSwiYXBpIjp0cnVlLCJqdGkiOiJiMzk1NTZiNy04MWE4LTRkMDAtYTRmMS04ZDgwODU2ZGQzZDgiLCJ1aWQiOiJJRDQwMEMyRDRBMzYiLCJlbWFpbCI6ImRlbW9AY29pbmZpZWxkLmNvbSJ9.Yp61vZSBEFjLl16Cr1MUSLWYvpaNAXnw6GkE5T2Ig720e5-c4h9ykCTGXIUuwFp2owfsnD2SeuPs68ngs_N9FOsRNHlWxol-0zlGKzAHKgH5k_FL_7XELi_K7vGjN5IzYH_FIr_G1ujgV55tWIq61tFoqAIUyBVZ3whqKrU6srCHYyapCyBPNeOFD_GVb18Q_Lr1J24LTAkmDdiabNTiCEZOfmpAvkULrXpo3gLtXWhEqvTX2kMNWBI91NB5VxXphFyCzoi2O28JznKWXbn7oTWusSMdxAMyU2weg09phTwGag5IeX_yvP1qr0F1e4MjENuzMXz97J1gIVCe8JXWlg'
            headers = {
                'Authorization': 'Bearer ' + this.apiKey,
            }
        }
        const url = this.urls['api'] + request;
        console.log("HEREEEE", url)
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

}