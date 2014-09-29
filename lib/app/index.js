var logger = require('logfmt');
var Promise = require('promise');
var uuid = require('node-uuid');
var EventEmitter = require('events').EventEmitter;

var connections = require('./connections');
var ArticleModel = require('./article-model');

var SCRAPE_QUEUE = 'jobs.scrape';

function App(config) {
  EventEmitter.call(this);

  this.connections = connections(config.mongo_url, config.rabbit_url);
  this.connections.once('ready', this.onConnected.bind(this));
  this.connections.once('lost', this.onLost.bind(this));
}

module.exports = function createApp(config) {
  return new App(config);
};

App.prototype = Object.create(EventEmitter.prototype);

App.prototype.onConnected = function() {
  this.Article = ArticleModel(this.connections.db);
  this.connections.queue.create(SCRAPE_QUEUE, { prefetch: 5 }, this.onReady.bind(this));
};

App.prototype.onReady = function() {
  logger.log({ type: 'info', msg: 'app.ready' });
  this.emit('ready');
};

App.prototype.onLost = function() {
  logger.log({ type: 'info', msg: 'app.lost' });
  this.emit('lost');
};

App.prototype.addArticle = function(url) {
  var id = uuid.v1();
  this.connections.queue.publish(SCRAPE_QUEUE, { id: id, url: url });
  return Promise.resolve(id);
};

App.prototype.scrapeArticle = function(id, url) {
  return this.Article.scrape(id, url);
};

App.prototype.getArticle = function(id) {
  return this.Article.get(id);
};

App.prototype.listArticles = function(n) {
  return this.Article.list(n);
};

App.prototype.startScraping = function() {
  this.connections.queue.handle(SCRAPE_QUEUE, this.handleScrapeJob.bind(this));
  return this;
};

App.prototype.handleScrapeJob = function(job, done) {
  logger.log({ type: 'info', msg: 'job in jobs.scrape', url: job.url });

  this
    .scrapeArticle(job.id, job.url)
    .then(onSuccess, onError);

  function onSuccess() {
    logger.log({ type: 'info', msg: 'job complete', status: 'success', url: job.url });
    done();
  }

  function onError() {
    logger.log({ type: 'info', msg: 'job complete', status: 'failure', url: job.url });
    done();
  }
};

App.prototype.stopScraping = function() {
  this.connections.queue.ignore('jobs.scrape');
  return this;
};

App.prototype.reset = function() {
  return this.Article.deleteAll();
};
