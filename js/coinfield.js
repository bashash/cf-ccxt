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
    sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let request = '/';
        request += path;
        if (api === 'public') {
            if (method === 'GET') {
                if (Object.keys(params).length) {
                    const { limit, timestamp, from, order_by} = params;
                    // request += '?' +
                }
            }
        } else if (api === 'private') {
            // const jwt = this.jwt (request, this.encode (this.secret));
            this.apiKey = 'eyJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE1ODUxNzg5ODEsImV4cCI6MTU4NTI2NTMzOCwic3ViIjoic2Vzc2lvbiIsImlzcyI6InVhYyIsInNjcCI6WyJvcmRlcnMiXSwiYXBpIjp0cnVlLCJqdGkiOiJiMzk1NTZiNy04MWE4LTRkMDAtYTRmMS04ZDgwODU2ZGQzZDgiLCJ1aWQiOiJJRDQwMEMyRDRBMzYiLCJlbWFpbCI6ImRlbW9AY29pbmZpZWxkLmNvbSJ9.Yp61vZSBEFjLl16Cr1MUSLWYvpaNAXnw6GkE5T2Ig720e5-c4h9ykCTGXIUuwFp2owfsnD2SeuPs68ngs_N9FOsRNHlWxol-0zlGKzAHKgH5k_FL_7XELi_K7vGjN5IzYH_FIr_G1ujgV55tWIq61tFoqAIUyBVZ3whqKrU6srCHYyapCyBPNeOFD_GVb18Q_Lr1J24LTAkmDdiabNTiCEZOfmpAvkULrXpo3gLtXWhEqvTX2kMNWBI91NB5VxXphFyCzoi2O28JznKWXbn7oTWusSMdxAMyU2weg09phTwGag5IeX_yvP1qr0F1e4MjENuzMXz97J1gIVCe8JXWlg'
            headers = {
                'Authorization': 'Bearer ' + this.apiKey,
            }
        }
        const url = this.urls['api'] + request;

        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

}