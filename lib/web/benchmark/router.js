var uuid = require('node-uuid');
var express = require('express');
var path = require('path');
var logger = require('logfmt');

var ADD_ARTICLE_CHANCE    = 0.02;
var UPVOTE_ARTICLE_CHANCE = 0.20;
var FETCH_URL = 'http://www.washingtonpost.com/world/national-security/twitter-sues-us-government-over-limits-on-ability-to-disclose-surveillance-orders/2014/10/07/5cc39ba0-4dd4-11e4-babe-e91da079cb8a_story.html';

module.exports = function benchmarksRouter(app, enabled) {
  var router = new express.Router();
  if (enabled) router.get('/benchmark.json', listArticles, benchmark);
  return router;

  function listArticles(req, res, next) {
    app
      .listArticles(15, req.user.id)
      .then(attachArticles, next);

    function attachArticles(list) {
      req.articles = list;
      next();
    }
  }

  function benchmark(req, res, next) {
    var roll = Math.random();
    if (roll < ADD_ARTICLE_CHANCE) addArticle(req, res, next);
    else if (roll < UPVOTE_ARTICLE_CHANCE) upvoteArticle(req, res, next);
    else res.json(req.articles);
  }

  function addArticle(req, res, next) {
    logger.log({ type: 'info', msg: 'benchmarking', branch: 'addArticle' });

    app
      .addArticle(req.user.id, FETCH_URL)
      .then(sendLink, next);

    function sendLink(id) {
      res.json({ link: '/articles/' + id + '.json' });
    }
  }

  function upvoteArticle(req, res, next) {
    logger.log({ type: 'info', msg: 'benchmarking', branch: 'upvoteArticle' });

    var articles = req.articles;
    if (!articles.length) return next(new Error('No article to upvote'));
    var rand = Math.floor(articles.length * Math.random());

    app
      .upvoteArticle(articles[rand].id, req.user.id)
      .then(sendVotes, next);

    function sendVotes(article) {
      return res.json(article);
    }
  }
};
