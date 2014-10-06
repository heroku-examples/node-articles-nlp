var logger = require('logfmt');
var cpus = require('os').cpus().length;
var http = require('http');
var throng = require('throng');

var config = require('./config');
var app = require('./app');
var web = require('./web');

http.globalAgent.maxSockets = Infinity;
throng(start, { workers: config.concurrency });

function start() {
  logger.log({
    type: 'info',
    msg: 'starting server',
    concurrency: config.concurrency,
    thrifty: config.thrifty,
    timeout: config.timeout,
    busy_ms: config.busy_ms
  });

  var instance = app(config);
  instance.on('ready', createServer);
  instance.on('lost', abort);

  function createServer() {
    if (config.thrifty) instance.startScraping();
    var server = http.createServer(web(instance, config));

    process.on('SIGTERM', shutdown);
    instance
      .removeListener('lost', abort)
      .on('lost', shutdown);

    server.listen(config.port, onListen);

    function onListen() {
      logger.log({ type: 'info', msg: 'listening', port: server.address().port });
    }

    function shutdown() {
      logger.log({ type: 'info', msg: 'shutting down' });
      server.close(function() {
        logger.log({ type: 'info', msg: 'exiting' });
        process.exit();
      });
    }
  }

  function abort() {
    logger.log({ type: 'info', msg: 'shutting down', abort: true });
    process.exit();
  }
}
