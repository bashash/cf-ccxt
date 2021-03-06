'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, BadRequest, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection } = require('./base/errors');

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
        //private
        'fetchOpenOrders': true,
        'fetchOrders': true,
        'fetchMyTrades': true,
        'createOrder': true,
        'cancelOrder': true,
        'cancelOrders': true,
        'fetchBalance': true,
      },
      'headers': {
        'Language': 'en_US',
      },
      'urls': {
        'logo': 'https://user-images.githubusercontent.com/1294454/28051642-56154182-660e-11e7-9b0d-6042d1e6edd8.jpg',
        'api': 'https://api.coinfield.com/v1',
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
            'account',
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

  async fetchAccount() {
    const response = await this.privateGetAccount();
    return response ? response.account : {};
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
    const balances = this.safeValue(response, 'wallets');
    const result = { 'info': response };
    for (let i = 0; i < balances.length; i++) {
      const balance = balances[i];
      const currencyId = this.safeString(balance, 'currency');
      const code = this.safeCurrencyCode(currencyId);
      const account = this.account();
      account['total'] = this.safeFloat(balance, 'balance') + this.safeFloat(balance, 'locked');
      account['free'] = this.safeFloat(balance, 'balance');
      account['used'] = this.safeFloat(balance, 'locked');
      result[code.toUpperCase()] = account;
    }
    return this.parseBalance(result);
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
      'limit': limit ? limit : 50,
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

  // parseTrades (trades, market = undefined, since = undefined, limit = undefined, params = {}) {
  //     let result = Object.values (trades || []).map ((trade) => this.extend (this.parseTrade (trade, market), params))
  //     result = this.sortBy (result, 'timestamp')
  //     return result;
  // }

  parseTrade(trade, market = undefined) {
    const id = this.safeString(trade, 'id');
    const timestamp = this.parse8601(this.safeString(trade, 'executed_at'));
    const datetime = this.iso8601(timestamp);
    const price = this.safeFloat(trade, 'price');
    const amount = this.safeFloat(trade, 'volume');
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
      'price': price,
      'amount': amount,
      'cost': cost,
      'fee': undefined,
    };
  }

  async fetchOrderBook(symbol, limit = undefined, params = {}) {
        await this.loadMarkets();
    const request = {
      'market': this.marketId(symbol),
      'limit': limit ? limit : 50,
    };
    let orderbook = await this.publicGetOrderbookMarket(request);
    const { timestamp } = orderbook;
    const pba =  (bidask, priceKey = 0, amountKey = 1)=> {
      const price = parseFloat (bidask[priceKey])
      const amount = parseFloat (bidask[amountKey])
      const id = bidask.id;
      return [ price, amount, id ]
    }

    const pbas = (bidasks, priceKey = 0, amountKey = 1) =>{
      return Object.values (bidasks || []).map (bidask => pba (bidask, priceKey, amountKey))
    }

    return {
      'bids': this.sortBy (("bids" in orderbook) ? pbas (orderbook["bids"], "price", "volume") : [], 0, true),
      'asks': this.sortBy (("asks" in orderbook) ? pbas (orderbook["asks"], "price", "volume") : [], 0),
      'timestamp': timestamp,
      'datetime': this.iso8601 (timestamp),
      'nonce': undefined,
    }
  }

  async fetchOrders(symbol = undefined, since = undefined, limit = 50, params = {}) {
    if (symbol === undefined) {
      throw new ArgumentsRequired(this.id + ' fetchOrders requires a symbol argument');
    }
    await this.loadMarkets();
    const market = this.market(symbol);
    const marketName = this.marketId(symbol)
    const request = {
      'market': marketName,
      'limit': limit ? limit : 50,
    }
    const response = await this.privateGetOrdersMarket(this.extend(request, params));
    return this.parseOrders(response.orders, market, since, limit);
  }

  async fetchOpenOrders(symbol = undefined, since = undefined, limit = 50, params = {}) {
    if (symbol === undefined) {
      throw new ArgumentsRequired(this.id + ' fetchOrders requires a symbol argument');
    }
    await this.loadMarkets();
    const market = this.market(symbol);
    const marketName = this.marketId(symbol);
    const request = {
      'market': marketName,
      'limit': limit ? limit : 50,
      'state': 'open,pending',
    }
    const response = await this.privateGetOrdersMarket(this.extend(request, params));
    return this.parseOrders(response.orders, market, since, limit);
  }

  parseOrders(orders, market = undefined, since = undefined, limit = undefined, params = {}) {
    let result = Object.values(orders).map(order => this.extend(this.parseOrder(order, market), params))
    result = this.sortBy(result, 'timestamp')
    return result;
  }

  parseOrder(order, market = undefined) {
    const {
      id,
      // side,
      type,
      strategy,
      state,
    } = order;
    const timestamp = this.parse8601(this.safeString(order, 'created_at'));
    const datetime = this.iso8601(timestamp);
    const symbol = this.safeString(order, 'market');
    const price = this.safeFloat(order, 'price');
    const average = this.safeFloat(order, 'average_execution_price');
    const amount = this.safeFloat(order, 'volume_initial');
    const cost = Number(order.price) * Number(order.volume_initial);
    const remaining = this.safeFloat(order, 'volume_remaining');
    const filled = this.safeFloat(order, 'volume_executed');
    return {
      'id': id,
      'timestamp': timestamp,
      'datetime': datetime,
      'lastTradeTimestamp': undefined,
      'status': state,
      'symbol': symbol,
      'type': strategy,
      'side': type,
      'price': price,
      'average': average,
      'cost': cost,
      'amount': amount,
      'filled': filled,
      'remaining': remaining,
      'fee': undefined,
      'info': order,
    }
  }

  async fetchMyTrades(symbol = undefined, since = undefined, limit = undefined, params = {}) {
    if (symbol === undefined) {
      throw new ArgumentsRequired(this.id + ' fetchMyTrades requires a `symbol` argument');
    }
    await this.loadMarkets();
    const market = this.market(symbol);
    const request = {
      'market': market['id'],
      'limit': limit ? limit : 50,
      'since': since ? since : '',
    };
    
    const account = await this.fetchAccount();
    const uid = this.safeString(account, 'uid');
    const response = await this.privateGetTradeHistoryMarket(this.extend(request, params));
    return this.parseMyTrades(response.trades, symbol, since, limit, uid);
  }

  parseMyTrades(trades, market = undefined, since = undefined, limit = undefined, uid, params = {}) {
    let result = Object.values(trades || []).map((trade) => this.extend(this.parseMyTrade(trade, market, uid), params))
    result = this.sortBy(result, 'timestamp')
    return result;
  }

  parseMyTrade(trade, market = undefined, uid) {
    const id = this.safeString(trade, 'id');
    const timestamp = this.parse8601(this.safeString(trade, 'executed_at'));
    const datetime = this.iso8601(timestamp);
    const symbol = market;
    const price = this.safeFloat(trade, 'price');
    const amount = this.safeFloat(trade, 'volume');
    const cost = this.safeFloat(trade, 'funds');
    const ask_behavior = this.safeString(trade, 'ask_behavior');
    const bid_behavior = this.safeString(trade, 'bid_behavior');
    const buyer_id = this.safeString(trade, "buyer_id");
    const seller_id = this.safeString(trade, "seller_id");
    const side = seller_id === uid ? "ask" : "bid";
    const takerOrMaker = side === "ask" ? ask_behavior : bid_behavior;

    return {
      'id': id,
      'timestamp': timestamp,
      'datetime': datetime,
      'symbol': symbol,
      'order': id,
      'type': undefined,
      'side': side,
      'takerOrMaker': takerOrMaker,
      'price': price,
      'amount': amount,
      'cost': cost,
      'fee': undefined,
      'info': trade,
    };
  }

  async createOrder(symbol, type, side, amount, price = undefined, params = {}) {
    await this.loadMarkets();
    const request = side === 'bid' && type === 'market'
      ? {
        'market': this.marketId(symbol),
        'type': side,
        'strategy': type,
        'funds': amount,
      }
      : {
        'market': this.marketId(symbol),
        'type': side,
        'strategy': type,
        'volume': amount,
        'price': price,
      };
    const response = await this.privatePostOrder(this.extend(request, params));
    const { order } = response;
    const { id } = order;
    return {
      'id': id,
      'info': response,
    }
  }

  async cancelOrder(id, symbol = undefined, params = {}) {
    if (symbol === undefined) {
      throw new ArgumentsRequired(this.id + ' cancelOrder() requires a `symbol` argument');
    }
    await this.loadMarkets();
    const request = id === 'all'
      ? { 'market': this.marketId(symbol) }
      : { 'id': id };

    return id === 'all'
      ? await this.privateDeleteOrdersMarket(this.extend(request, params))
      : await this.privateDeleteOrderId(this.extend(request, params));
  }

  async cancelOrders(symbol, side, params = {}) {
    if (symbol === undefined) {
      throw new ArgumentsRequired('cancelOrders() requires a `symbol` argument');
    }
    await this.loadMarkets();
    const request = { 'market': this.marketId(symbol), 'side': side };
    return this.privateDeleteOrdersMarket(this.extend(request, params))
  }

  createBody(params) {
    const {
      market,
      type,
      strategy,
      expiry,
      immediate,
      timeInForce,
    } = params;
    let funds;
    if (params.funds !== undefined) {
      funds = this.safeString(params, 'funds');
    }
    let volume;
    if (params.volume !== undefined) {
      volume = this.safeString(params, 'volume');
    }
    let price;
    if (params.price !== undefined) {
      price = this.safeString(params, 'price');
    }
    let stop_price;
    if (stop_price !== undefined) {
      stop_price = this.safeString(params, 'stop_price');
    }
    let body;
    if (strategy === 'market') {
      body = type === 'bid'
        ? {
          'market': market,
          'type': type,
          'strategy': strategy,
          'funds': funds,
        }
        : {
          'market': market,
          'type': type,
          'strategy': strategy,
          'volume': volume,
        }
    } else if (strategy === 'limit') {
      body = timeInForce
        ? {
          'market': market,
          'type': type,
          'strategy': strategy,
          'volume': volume,
          'price': price,
          'immediate': immediate,
        }
        : {
          'market': market,
          'type': type,
          'strategy': strategy,
          'volume': volume,
          'price': price,
          'expiry': expiry,
          'immediate': immediate,
        }
    } else if ('stop_limit') {
      body = timeInForce
        ? {
          'market': market,
          'type': type,
          'strategy': strategy,
          'volume': volume,
          'price': price,
          'stop_price': stop_price,
          'immediate': immediate,
        }
        : {
          'market': market,
          'type': type,
          'strategy': strategy,
          'volume': volume,
          'price': price,
          'stop_price': stop_price,
          'expiry': expiry,
          'immediate': immediate,
        }
    }
    return body;
  }

  sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
    let request = '/';
    request += this.implodeParams(path, params);
    const query = this.omit(params, this.extractParams(path));

    if (api === 'private') {
      headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.apiKey,
      }
      if (method === 'POST') {
        if (Object.values(params).length) {
          body = this.json(this.createBody(params));
        }
      } else {
        if (Object.keys(query).length) {
          request += '?' + this.urlencode(query);
        }
      }
    } else {
      if (method === 'GET') {
        if (Object.keys(query).length) {
          request += '?' + this.urlencode(query);
        }
      }
    }

    const url = this.urls['api'] + request;
    return { 'url': url, 'method': method, 'body': body, 'headers': headers };
  }
}
