var express = require('express');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');
var path = require('path');
var compression = require('compression');
var session = require('cookie-session');

// Shared modules and middleware
var errors = require('./errors');
var logs = require('./logs');

// Routers
var users = require('./users/router');
var articles = require('./articles/router');
var benchmark = require('./benchmark/router');

// Constants
var ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

module.exports = function Web(app, config) {
  var web = express();
  var errs = errors(config.verbose);
  var icon = path.join(__dirname, 'public', 'node-favicon.png');

  // Express configuration
  web
    .set('view engine', 'jade')
    .set('view cache', config.view_cache);

  // Shared middleware
  web
    .use(compression())
    .use(favicon(icon))
    .use(logs(config.verbose))
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended: true }))
    .use(session({ secret: config.cookie_secret, maxAge: ONE_WEEK }));

  // Routers
  web
    .use(users(app))
    .use(articles(app))
    .use(benchmark(app, config.benchmark, config.benchmark_add, config.benchmark_vote));

  // Shared error handling
  web
    .use(errs.notFound)
    .use(errs.log)
    .use(errs.json)
    .use(errs.html);

  return web;
};
