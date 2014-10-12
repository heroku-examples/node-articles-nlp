var http = require('http');
var logger = require('logfmt');
var throng = require('throng');

var config = require('./config');
var app = require('./app');

http.globalAgent.maxSockets = Infinity;
throng(start, { workers: config.worker_concurrency });

function start() {
  logger.log({
    type: 'info',
    msg: 'starting worker',
    concurrency: config.concurrency
  });

  var instance = app(config);

  instance.on('ready', beginWork);
  process.on('SIGTERM', shutdown);

  function beginWork() {
    instance.on('lost', shutdown);
    instance.startScraping();
  }

  function shutdown() {
    logger.log({ type: 'info', msg: 'shutting down' });
    process.exit();
  }
}
