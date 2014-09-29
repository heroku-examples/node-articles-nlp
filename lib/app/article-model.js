var mongoose = require('mongoose');
var timestamps = require('mongoose-timestamp');
var crypto = require('crypto');
var logger = require('logfmt');
var Promise = require('promise');
var summarize = require('summarize');
var superagent = require('superagent');

var STATES = ['pending', 'complete', 'failed'];

module.exports = function createArticleModel(connection) {

  var Schema = mongoose.Schema({
    _id: { type: String },
    url: { type: String, unique: true, index: true },
    title: { type: String },
    image: { type: String },
    topics: [ String ],
    sentiment: { type: Number },
    words: { type: Number },
    difficulty: { type: Number },
    minutes: { type: Number }
  });

  Schema.plugin(timestamps);

  Schema.statics.scrape = function(id, url) {
    return new Promise(function(resolve, reject) {
      var Article = this;

      superagent
        .get(url)
        .on('error', reject)
        .end(onResponse);

      function onResponse(res) {
        var summary = summarize(res.text, 10);
        if (!summary.ok) return reject(new Error('Unable to scrape'));
        new Article({ _id: id, url: url })
          .set(summary)
          .save(onSave);
      }

      function onSave(err, article) {
        if (err) {
          logger.log({ type: 'error', msg: 'could not save', url: url, error: err });
          return reject(err);
        }
        logger.log({ type: 'info', msg: 'saved article', id: id, url: url });
        return resolve(article);
      }

    }.bind(this));
  };

  Schema.statics.get = function(id) {
    return new Promise(function(resolve, reject) {
      this.findById(id).exec(function(err, article) {
        if (err) return reject(err);
        resolve(article);
      });
    }.bind(this));
  };

  Schema.statics.list = function(n) {
    return new Promise(function(resolve, reject) {
      this.find().sort('-createdAt').limit(n || 50).exec(function(err, articles) {
        if (err) return reject(err);
        resolve(articles);
      });
    }.bind(this));
  };

  Schema.statics.deleteAll = function() {
    return new Promise(function(resolve, reject) {
      this.remove().exec(function(err) {
        if (err) return reject(err);
        resolve();
      });
    }.bind(this));
  };

  var Article = connection.model('Article', Schema);
  return Article;
};
