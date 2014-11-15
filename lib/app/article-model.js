var mongoose = require('mongoose');
var cache = require('mongoose-cache');
var timestamps = require('mongoose-timestamp');
var crypto = require('crypto');
var logger = require('logfmt');
var Promise = require('promise');
var summarize = require('summarize');
var superagent = require('superagent');
var _ = require('lodash');

var errors = require('./errors');

var STATES = ['pending', 'complete', 'failed'];
var FIVE_MINUTES = 1000 * 60 * 5;

module.exports = function createArticleModel(connection, maxAge) {

  // Monkey-patch Mongoose to support in-memory caching for 10s
  cache.install(mongoose, {
    max: 50,
    maxAge: maxAge
  });

  var Schema = mongoose.Schema({
    _id: { type: String },
    url: { type: String, unique: true, index: true },
    title: { type: String },
    image: { type: String },
    topics: [ String ],
    sentiment: { type: Number },
    words: { type: Number },
    difficulty: { type: Number },
    minutes: { type: Number },
    votes: { type: [ String ], required: true, default: [ ] }
  }, {
    strict: true
  });

  Schema.plugin(timestamps);

  Schema.virtual('voteCount').get(function getVoteCount() {
    return this.votes.length;
  });

  Schema.set('toJSON', {
    getters: true,
    transform: function safeTransform(doc, ret, options) {
      delete ret.votes;
    }
  });

  Schema.statics = {

    scrape: function(userId, id, url) {
      return new Promise(function(resolve, reject) {
        var Article = this;

        superagent
          .get(url)
          .on('error', reject)
          .end(onResponse);

        function onResponse(res) {
          var summary = summarize(res.text, 10);
          if (!summary.ok) return reject(new errors.ScrapeFailed());
          new Article({ _id: id, url: url, votes: [userId] })
            .set(summary)
            .save(onSave);
        }

        function onSave(err, article) {
          if (err) {
            logger.log({ type: 'error', msg: 'could not save', url: url, error: err });
            return reject(err);
          }
          logger.log({ type: 'info', msg: 'saved article', id: article.id, url: article.url, votes: article.votes });
          return resolve(article);
        }

      }.bind(this));
    },

    get: function(id) {
      return new Promise(function(resolve, reject) {
        this.findById(id).exec(function(err, article) {
          if (err) return reject(err);
          if (!article) return reject(new errors.ArticleNotFound());
          resolve(article);
        });
      }.bind(this));
    },

    list: function(userId, n, fresh) {
      return new Promise(function(resolve, reject) {
        this.find()
          .sort('-createdAt')
          .limit(n || 50)
          .cache(!fresh)
          .exec(onArticles);

        function onArticles(err, articles) {
          if (err) return reject(err);
          resolve(articles.sort(byScore).map(toUser));
        }
      }.bind(this));

      function toUser(article) {
        return article.forUser(userId);
      }

      function byScore(a, b) {
        return b.getScore() - a.getScore();
      }
    },

    deleteAll: function() {
      return new Promise(function(resolve, reject) {
        this.remove().exec(function(err) {
          if (err) return reject(err);
          resolve();
        });
      }.bind(this));
    },

    voteFor: function(userId, articleId) {
      return this.get(articleId).then(vote, notFound);

      function vote(article) {
        return article.addVote(userId).then(success, failure);
      }

      function notFound(err) {
        return Promise.reject(new errors.ArticleNotFound());
      }

      function success(article) {
        return Promise.resolve(article.forUser(userId));
      }

      function failure(err) {
        return Promise.reject(err);
      }
    }
  };



  Schema.methods = {

    addVote: function(userId) {
      return new Promise(function(resolve, reject) {
        if (this.votes.indexOf(userId) !== -1) {
          return reject(new errors.VoteNotAllowed());
        }

        this.votes.push(userId);
        this.save(onSave);

        function onSave(err, article) {
          if (err) return reject(err);
          resolve(article);
        }
      }.bind(this));
    },

    forUser: function(userId) {
      var obj = this.toJSON();
      obj.canVote = (this.votes.indexOf(userId) === -1);
      return obj;
    },

    getScore: function() {
      var staleness = Math.floor((Date.now() - this.createdAt) / FIVE_MINUTES);
      if (staleness === 0) staleness = -Infinity;
      return this.voteCount - staleness;
    }
  };

  var Article = connection.model('Article', Schema);
  return Article;
};
