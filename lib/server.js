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
  var instance = app(config);
  instance.on('ready', createServer);

  function createServer() {
    if (config.thrifty) instance.startScraping();
    var server = http.createServer(web(instance, config));

    server.listen(config.port, onListen);
    process.on('SIGTERM', shutdown);

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
}
