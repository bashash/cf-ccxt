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
                // 'fetchTicker': true,
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
                'logo': 'https://user-images.githubusercontent.com/1294454/28051642-56154182-660e-11e7-9b0d-6042d1e6edd8.jpg',
                'api': 'https://api.coinfield.com/v1',
                'www': 'https://www.cointiger.com/en-us/#/index',
                'doc': 'https://github.com/cointiger/api-docs-en/wiki',
            },
            'api': {
                'public': {
                    'get': [
                        'markets',
                        'orderbook/{market}',
                        'tickers',
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
}