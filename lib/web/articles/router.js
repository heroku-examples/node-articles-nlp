var express = require('express');
var path = require('path');

var ERR_MAP = {
  'ArticleNotFound': 404,
  'VoteNotAllowed': 403,
  'ScrapeFailed': 500
};

module.exports = function articlesRouter(app) {

  return new express.Router()
    .get('/', showForm)
    .get('/articles.json', listArticles)
    .get('/articles/:articleId.json', showArticle)
    .post('/articles/:articleId/vote.json', upvoteArticle)
    .post('/articles.json', addArticle)
    .use(articleErrors)
    .use(express.static(path.join(__dirname, 'public')));

  function showForm(req, res, next) {
    res.render(path.join(__dirname, 'list'));
  }

  function listArticles(req, res, next) {
    app
      .listArticles(req.user.id, 15, req.param('fresh'))
      .then(sendList, next);

    function sendList(list) {
      res.json(list);
    }
  }

  function addArticle(req, res, next) {
    app
      .addArticle(req.user.id, req.body.url)
      .then(sendLink, next);

    function sendLink(id) {
      res.json({ link: '/articles/' + id + '.json' });
    }
  }

  function showArticle(req, res, next) {
    app
      .getArticle(req.params.articleId)
      .then(sendArticle, next);

    function sendArticle(article) {
      return res.json(article);
    }
  }

  function upvoteArticle(req, res, next) {
    app
      .addUpvote(req.user.id, req.params.articleId)
      .then(sendLink, next);

    function sendLink(id) {
      return res.json({ link: '/articles/' + id + '.json' });
    }
  }

  function articleErrors(err, req, res, next) {
    var status = ERR_MAP[err.name];
    if (status) err.status = status;
    next(err);
  }
};
