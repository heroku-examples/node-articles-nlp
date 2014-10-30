var uuid = require('node-uuid');
var express = require('express');
var path = require('path');
var logger = require('logfmt');

var ARTICLE_URLS = [
  'http://www.washingtonpost.com/world/national-security/twitter-sues-us-government-over-limits-on-ability-to-disclose-surveillance-orders/2014/10/07/5cc39ba0-4dd4-11e4-babe-e91da079cb8a_story.html',
  'http://rw.runnersworld.com/sub-2/',
  'http://scottbarbian.com/the-toughest-adversity-ive-ever-faced',
  'http://www.quora.com/How-does-a-fighter-jet-lock-onto-and-keep-track-of-an-enemy-aircraft?share=1',
  'http://www.forestmoon.com/BIRTHofVB/BIRTHofVB.html',
  'http://www.technologyreview.com/photoessay/531606/microsofts-quantum-mechanics/',
  'http://www.nature.com/news/famed-antikythera-wreck-yields-more-treasures-1.16124',
  'http://nautil.us/blog/human-vs-squirrel-the-battle-of-wits-is-on',
  'https://www.eff.org/deeplinks/2014/08/def-con-router-hacking-contest-success-fun-learning-and-profit-many',
  'http://www.economist.com/news/essays/21623373-which-something-old-and-powerful-encountered-vault',
  'http://www.npr.org/2014/10/09/354846672/bad-paper-explores-the-underworld-of-debt-collection',
  'https://dev.opera.com/articles/css-twenty-years-hakon/',
  'http://neverworkintheory.org/2014/10/08/simple-testing-can-prevent-most-critical-failures.html'
];

module.exports = function benchmarksRouter(app, enabled, addChance, voteChance) {
  var router = new express.Router();
  if (enabled) {
    router.get('/benchmark.json', listArticles, benchmark);
    router.get('/baseline.json', baseline);
  }
  return router;

  function listArticles(req, res, next) {
    app
      .listArticles(req.user.id, 15)
      .then(attachArticles, next);

    function attachArticles(list) {
      req.articles = list;
      next();
    }
  }

  function benchmark(req, res, next) {
    var roll = Math.random();
    if (roll < addChance) addArticle(req, res, next);
    else if (roll < voteChance) upvoteArticle(req, res, next);
    else res.json(req.articles);
  }

  function addArticle(req, res, next) {
    logger.log({ type: 'info', msg: 'benchmarking', branch: 'addArticle' });
    var rand = Math.floor(Math.random() * ARTICLE_URLS.length);

    app
      .addArticle(req.user.id, ARTICLE_URLS[rand])
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
      .addUpvote(req.user.id, articles[rand].id)
      .then(sendLink, next);

    function sendLink(id) {
      res.json({ link: '/articles/' + id + '.json' });
    }
  }

  function baseline(req, res, next) {
    res.send('ok');
  }
};
