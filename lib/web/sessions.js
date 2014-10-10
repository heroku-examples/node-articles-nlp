var expressSession = require('express-session');
var redisUrl = require('redis-url');
var RedisStore = require('connect-redis')(expressSession);
var logger = require('logfmt');

module.exports = function Sessions(url, secret) {
  //var client = redisUrl.connect(url);
  // TODO: make rediscloud and redis-url compatible
  // rediscloud sends username:password in its URL
  // redis-url expects (username) to be (database)
  // rediscloud doesn't support databases other than 0
  // so using redis-url + rediscloud fails
  var store = new RedisStore({ url: url });
  var session = expressSession({
    secret: secret,
    store: store,
    resave: true,
    saveUninitialized: true
  });

  store.client.on('connect', function() {
    logger.log({ type: 'info', msg: 'connected', service: 'redis' });
  });

  store.client.on('error', function(err) {
    logger.log({ type: 'error', msg: 'error', service: 'redis', err: err.stack || err.message });
  });

  store.client.on('end', function() {
    logger.log({ type: 'error', msg: 'disconnected', service: 'redis' });
    throw new Error('Disconnected from redis');
  });

  return session;
};
