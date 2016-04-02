var logger = require('logfmt');
var Promise = require('promise');
var EventEmitter = require('events').EventEmitter;

var connections = require('../app/connections');
var ArticleModel = require('../app/article-model');

var SCRAPE_QUEUE = 'jobs.scrape';
var VOTE_QUEUE = 'jobs.vote';

function Work(config) {
  logger.log({ type: 'info', msg: 'work/index.Work' });
  EventEmitter.call(this);

  this.config = config;
  this.connections = connections(config.mongo_url, config.rabbit_url);
  this.connections.once('ready', this.onConnected.bind(this));
  this.connections.once('lost', this.onLost.bind(this));
}

module.exports = function createApp(config) {
  return new Work(config);
};

Work.prototype = Object.create(EventEmitter.prototype);

Work.prototype.onConnected = function() {
  logger.log({ type: 'info', msg: 'work/index.onConnected' });
  var queues = 0;
  this.Article = ArticleModel(this.connections.db, this.config.mongo_cache);
  this.connections.queue.create(SCRAPE_QUEUE, { prefetch: 5 }, onCreate.bind(this));
  this.connections.queue.create(VOTE_QUEUE, { prefetch: 5 }, onCreate.bind(this));

  function onCreate() {
    if (++queues === 2) this.onReady();
  }
};

Work.prototype.onReady = function() {
  logger.log({ type: 'info', msg: 'app.ready' });
  this.emit('ready');
};

Work.prototype.onLost = function() {
  logger.log({ type: 'info', msg: 'app.lost' });
  this.emit('lost');
};

Work.prototype.scrapeArticle = function(userId, id, url) {
  logger.log({ type: 'info', msg: 'work/index.scrapeArticle' });
  return this.Article.scrape(userId, id, url);
};

Work.prototype.upvoteArticle = function(userId, articleId) {
  logger.log({ type: 'info', msg: 'work/index.upvoteArticle' });
  return this.Article.voteFor(userId, articleId);
};

Work.prototype.startScraping = function() {
  logger.log({ type: 'info', msg: 'work/index.startScraping' });
  this.connections.queue.handle(SCRAPE_QUEUE, this.handleScrapeJob.bind(this));
  this.connections.queue.handle(VOTE_QUEUE, this.handleVoteJob.bind(this));
  return this;
};

// KEEP
Work.prototype.handleScrapeJob = function(job, ack) {
  logger.log({ type: 'info', msg: 'work/index.handleScrapeJob' });
  logger.log({ type: 'info', msg: 'handling job', queue: SCRAPE_QUEUE, url: job.url });

  this
    .scrapeArticle(job.userId, job.id, job.url)
    .then(onSuccess, onError);

  function onSuccess() {
    logger.log({ type: 'info', msg: 'job complete', status: 'success', url: job.url });
    ack();
  }

  function onError() {
    logger.log({ type: 'info', msg: 'job complete', status: 'failure', url: job.url });
    ack();
  }
};

// KEEP
Work.prototype.handleVoteJob = function(job, ack) {
  logger.log({ type: 'info', msg: 'handling job', queue: VOTE_QUEUE, articleId: job.articleId });

  this
    .upvoteArticle(job.userId, job.articleId)
    .then(onSuccess, onError);

  function onSuccess() {
    logger.log({ type: 'info', msg: 'job complete', queue: VOTE_QUEUE, status: 'success' });
    ack();
  }

  function onError(err) {
    logger.log({ type: 'info', msg: 'job complete', queue: VOTE_QUEUE, status: 'failure', error: err });
    ack();
  }
};

// KEEP
Work.prototype.stopScraping = function() {
  this.connections.queue.ignore(SCRAPE_QUEUE);
  this.connections.queue.ignore(VOTE_QUEUE);
  return this;
};

