var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var timeout = require('connect-timeout');
var loopbusy = require('loopbusy');
var blitz = require('blitzkrieg');
var favicon = require('serve-favicon');
var path = require('path');

// Shared modules and middleware
var sessions = require('./sessions');
var errors = require('./errors');
var logs = require('./logs');

// Routers
var articles = require('./articles/router');

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
    .use(favicon(icon))
    .use(loopbusy(config.busy_ms))
    .use(timeout(config.timeout))
    .use(logs(config.verbose))
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended: true }))
    .use(cookieParser(config.cookie_secret))
    .use(sessions(config.redis_url, config.session_secret));

  // Routers
  web
    .use(articles(app))
    .use(blitz(config.blitz_key));

  // Shared error handling
  web
    .use(errs.notFound)
    .use(errs.log)
    .use(errs.json)
    .use(errs.html);

  return web;
};
