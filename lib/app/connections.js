var mongoose = require('mongoose');
var jackrabbit = require('jackrabbit');
var logger = require('logfmt');
var EventEmitter = require('events').EventEmitter;

function Connector(mongoUrl, rabbitUrl) {
  EventEmitter.call(this);

  var self = this;
  var readyCount = 0;

  this.db = mongoose.createConnection(mongoUrl)
    .on('connected', function() {
      logger.log({ type: 'info', msg: 'connected', service: 'mongodb' });
      ready();
    })
    .on('error', function(err) {
      logger.log({ type: 'error', msg: err, service: 'mongodb' });
    })
    .on('close', function(str) {
      logger.log({ type: 'error', msg: 'closed', service: 'mongodb' });
    })
    .on('disconnected', function() {
      logger.log({ type: 'error', msg: 'disconnected', service: 'mongodb' });
      lost();
    });

  this.queue = jackrabbit(rabbitUrl)
    .on('connected', function() {
      logger.log({ type: 'info', msg: 'connected', service: 'rabbitmq' });
      ready();
    })
    .on('error', function(err) {
      logger.log({ type: 'error', msg: err, service: 'rabbitmq' });
    })
    .on('disconnected', function() {
      logger.log({ type: 'error', msg: 'disconnected', service: 'rabbitmq' });
      lost();
    });

  function ready() {
    if (++readyCount === 2) {
      self.emit('ready');
    }
  }

  function lost() {
    self.emit('lost');
  }
};

Connector.prototype = Object.create(EventEmitter.prototype);

module.exports = function(mongoUrl, rabbitUrl) {
  return new Connector(mongoUrl, rabbitUrl);
};
