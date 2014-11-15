var uuid = require('node-uuid');
var express = require('express');
var path = require('path');

module.exports = function articlesRouter(app) {

  return new express.Router()
    .use(loadUser);

  function loadUser(req, res, next) {
    req.session.user = req.session.user || { id: uuid.v1() };
    req.user = req.session.user;
    next();
  }
};
