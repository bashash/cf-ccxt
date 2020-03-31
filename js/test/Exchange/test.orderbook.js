'use strict'

// ----------------------------------------------------------------------------

const log       = require ('ololog')
    , ansi      = require ('ansicolor').nice
    , chai      = require ('chai')
    , expect    = chai.expect
    , assert    = chai.assert

// ----------------------------------------------------------------------------

const printOrderBookOneLiner = (orderbook, method, symbol) => {

    const bids = orderbook.bids
    const asks = orderbook.asks

    log (symbol.toString ().green,
        method,
        orderbook['nonce'] || orderbook['datetime'],
        bids.length, 'bids:', bids[0],
        asks.length, 'asks:', asks[0])
}

/*  ------------------------------------------------------------------------ */

module.exports = (exchange, orderbook, method, symbol) => {

    const format = {
        'bids': [],
        'asks': [],
        'timestamp': 1234567890,
        'datetime': '2017-09-01T00:00:00',
        'nonce': 134234234,
        // 'info': {},
    }

    expect (orderbook).to.have.all.keys (format)

    const bids = orderbook.bids
    const asks = orderbook.asks

    for (let i = 0; i < bids.length; i++) {
        if (bids.length > (i + 1)) {
            assert (bids[i][0] >= bids[i + 1][0])
        }
        assert (typeof bids[i][0] === 'number')
        assert (typeof bids[i][1] === 'number')
    }

    for (let i = 0; i < asks.length; i++) {
        if (asks.length > (i + 1)) {
            assert (asks[i][0] <= asks[i + 1][0])
        }
        assert (typeof asks[i][0] === 'number')
        assert (typeof asks[i][1] === 'number')
    }

    if (![

        'coinmarketcap',
        'xbtce',
        'coinsecure',
        'upbit', // an orderbook might have a 0-price ask occasionally
        'tokensnet',

    ].includes (exchange.id)) {

        if (bids.length && asks.length)
            assert (bids[0][0] <= asks[0][0],
                `bids[0][0]: ${bids[0][0]} (of ${bids.length}); asks[0][0]:${asks[0][0]} (of ${asks.length})`)

    }

    printOrderBookOneLiner (orderbook, method, symbol)
}