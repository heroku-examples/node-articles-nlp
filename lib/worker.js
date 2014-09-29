var logger = require('logfmt');
var throng = require('throng');

var config = require('./config');
var app = require('./app');

throng(start, { workers: config.concurrency });

function start() {
  var instance = app(config);

  instance.on('ready', beginWork);
  process.on('SIGTERM', shutdown);

  function beginWork() {
    instance.startScraping();
  }

  function shutdown() {
    logger.log({ type: 'info', msg: 'exiting' });
    process.exit();
  }
}
