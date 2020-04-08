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
                'logo': 'https://assets.coingecko.com/markets/images/370/large/IPdnUUW.png?1552380946',
                'api': 'https://api.probit.com/api/exchange/v1/',
                'www': 'https://www.probit.com/app',
                'doc': 'https://docs-en.probit.com/docs',
            },
            'api': {
                'public': {
                    'get': [
                        'market',
                        'order_book',
                        'ticker',
                        'trades'
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
                        'order/{id}',
                    ]
                },
            },
        });
    }
}