var expressSession = require('express-session');
var redisUrl = require('redis-url');
var RedisStore = require('connect-redis')(expressSession);
var logger = require('logfmt');

module.exports = function Sessions(url, secret) {
  //var client = redisUrl.connect(url);
  // TODO: fix redisUrl so it doesn't give "ERR invalid DB index"
  var store = new RedisStore(url: url);
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
