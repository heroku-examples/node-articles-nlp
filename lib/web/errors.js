var express = require('express');
var logger = require('logfmt');

module.exports = function Controller(verbose) {

  return {
    notFound: notFound,
    log: logError,
    json: jsonError,
    html: htmlError
  };

  function notFound(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  }

  function logError(err, req, res, next) {
    if (err.status === 404 && !verbose) {
      return next(err);
    }
    logger.log({
      type: 'error',
      msg: err.message || 'middleware error',
      err: err.stack || 'no stack trace available'
    });
    next(err);
  }

  function jsonError(err, req, res, next) {
    if (req.path.slice(-5) !== '.json') return next(err);
    if (!req.accepts('application/json')) return next(err);
    res
      .status(err.status || 500)
      .json({ message: err.message || 'Something went wrong!' });
  }

  function htmlError(err, req, res, next) {
    res
      .status(err.status || 500)
      .send(err.message || 'Something went wrong!');
  }
};
