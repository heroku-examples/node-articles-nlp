var logger = require('logfmt');
var Promise = require('promise');
var uuid = require('node-uuid');
var EventEmitter = require('events').EventEmitter;

var connections = require('./connections');
var ArticleModel = require('./article-model');

var SCRAPE_QUEUE = 'jobs.scrape';
var VOTE_QUEUE = 'jobs.vote';

function App(config) {
  logger.log({ type: 'info', msg: 'app/index.App' });
  EventEmitter.call(this);

  this.config = config;
  this.connections = connections(config.mongo_url, config.rabbit_url);
  this.connections.once('ready', this.onConnected.bind(this));
  this.connections.once('lost', this.onLost.bind(this));
}

module.exports = function createApp(config) {
  logger.log({ type: 'info', msg: 'app/index.createApp' });
  return new App(config);
};

App.prototype = Object.create(EventEmitter.prototype);

App.prototype.onConnected = function() {
  var queues = 0;
  this.Article = ArticleModel(this.connections.db, this.config.mongo_cache);
  this.connections.queue.create(SCRAPE_QUEUE, { prefetch: 5 }, onCreate.bind(this));
  this.connections.queue.create(VOTE_QUEUE, { prefetch: 5 }, onCreate.bind(this));

  function onCreate() {
    if (++queues === 2) this.onReady();
  }
};

App.prototype.onReady = function() {
  logger.log({ type: 'info', msg: 'app.ready' });
  this.emit('ready');
};

App.prototype.onLost = function() {
  logger.log({ type: 'info', msg: 'app.lost' });
  this.emit('lost');
};

App.prototype.addArticle = function(userId, url) {
  var id = uuid.v1();
  this.connections.queue.publish(SCRAPE_QUEUE, { id: id, url: url, userId: userId });
  return Promise.resolve(id);
};

App.prototype.addUpvote = function(userId, articleId) {
  this.connections.queue.publish(VOTE_QUEUE, { userId: userId, articleId: articleId });
  return Promise.resolve(articleId);
};

App.prototype.purgePendingArticles = function() {
  logger.log({ type: 'info', msg: 'app.purgePendingArticles' });

  return new Promise(function(resolve, reject) {
    this.connections.queue.purge(SCRAPE_QUEUE, onPurge);

    function onPurge(err, count) {
      if (err) return reject(err);
      resolve(count);
    }
  }.bind(this));
};

App.prototype.purgePendingVotes = function() {
  logger.log({ type: 'info', msg: 'app.purgePendingVotes' });

  return new Promise(function(resolve, reject) {
    this.connections.queue.purge(VOTE_QUEUE, onPurge);

    function onPurge(err, count) {
      if (err) return reject(err);
      resolve(count);
    }
  }.bind(this));
};

App.prototype.getArticle = function(id) {
  return this.Article.get(id);
};

App.prototype.listArticles = function(userId, n, fresh) {
  return this.Article.list(userId, n, fresh);
};

App.prototype.stopScraping = function() {
  this.connections.queue.ignore(SCRAPE_QUEUE);
  this.connections.queue.ignore(VOTE_QUEUE);
  return this;
};

App.prototype.deleteAllArticles = function() {
  logger.log({ type: 'info', msg: 'app.deleteAllArticles' });
  return this.Article.deleteAll();
};
