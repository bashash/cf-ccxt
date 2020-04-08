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
    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let request = '/';
        request += this.implodeParams (path, params);
        
        const url = this.urls['api'] + request;
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
}