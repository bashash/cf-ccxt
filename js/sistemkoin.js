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
                // 'fetchOrderBook': true,
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
                'api': 'https://api.sistemkoin.com/api/v1',
                'www': 'https://sistemkoin.com/',
                'doc': 'https://github.com/sistemkoin-exchange/sistemkoin-official-api-docs',
            },
            'api': {
                // 'public': {
                //     'get': [
                //         'market/pairs',
                //         'market/ticker',
                //     ]
                // },
                'private': {
                    'get': [
                        'account/orders',
                        'v1/account/trades',
                        'v1/account/balance',
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

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let request = '/';
        request += path;

        if (path === 'account/balance' || path === 'market') {
            this.signature = this.createSignature(params);

            headers = {
                'X-STK-ApiKey': this.apiKey,
            }
            // request += `?symbol=${}&type=${}&amount=${}&price=${}&recvWindow=${}&timestamp=${}&signature=${this.signature}`
        }
        const url = this.urls['api'] + request;
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
}