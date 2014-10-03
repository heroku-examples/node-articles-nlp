var mongoose = require('mongoose');
var timestamps = require('mongoose-timestamp');
var crypto = require('crypto');
var logger = require('logfmt');
var Promise = require('promise');
var summarize = require('summarize');
var superagent = require('superagent');
var _ = require('lodash');

var STATES = ['pending', 'complete', 'failed'];
var FIVE_MINUTES = 1000 * 60 * 5;

function ArticleNotFound() {
  Error.call(this);
  Error.captureStackTrace(this, ArticleNotFound);
  this.message = 'Article Not Found';
  this.status = 404;
}

ArticleNotFound.prototype = Object.create(Error.prototype);

function UserAlreadyVoted() {
  Error.call(this);
  Error.captureStackTrace(this, UserAlreadyVoted);
  this.message = 'User Already Voted';
  this.status = 403;
}

UserAlreadyVoted.prototype = Object.create(Error.prototype);

function UnableToScrape() {
  Error.call(this);
  Error.captureStackTrace(this, UnableToScrape);
  this.message = 'Unable to Scrape';
  this.status = 500;
}

UnableToScrape.prototype = Object.create(Error.prototype);


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
    minutes: { type: Number },
    votes: [ String ]
  });

  Schema.plugin(timestamps);

  Schema.virtual('voteCount').get(function getVoteCount() {
    return this.votes.length;
  });

  var safeObject = {
    getters: true,
    transform: function safeTransform(doc, ret, options) {
      delete ret.votes;
    }
  };

  Schema.set('toObject', safeObject);
  Schema.set('toJSON', safeObject);


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
          if (!summary.ok) return reject(new UnableToScrape());
          new Article({ _id: id, url: url, votes: [userId] })
            .set(summary)
            .save(onSave);
        }

        function onSave(err, article) {
          if (err) {
            logger.log({ type: 'error', msg: 'could not save', url: url, error: err });
            return reject(err);
          }
          logger.log({ type: 'info', msg: 'saved article', id: article.id, url: article.url, votes: article.votes, voteCount: article.voteCount });
          return resolve(article);
        }

      }.bind(this));
    },

    get: function(id) {
      return new Promise(function(resolve, reject) {
        this.findById(id).exec(function(err, article) {
          if (err) return reject(err);
          if (!article) return reject(new ArticleNotFound());
          resolve(article);
        });
      }.bind(this));
    },

    list: function(userId, n) {
      return new Promise(function(resolve, reject) {
        this.find().sort('-createdAt').limit(n || 50).exec(function(err, articles) {
          if (err) return reject(err);
          resolve(articles
            .sort(byTime)
            .sort(byScore)
            .map(toUser));
        });
      }.bind(this));

      function toUser(article) {
        return article.forUser(userId);
      }

      function byTime(a, b) {
        return b.createdAt - a.createdAt;
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
        return Promise.reject(new ArticleNotFound());
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
          return reject(new UserAlreadyVoted());
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
      var obj = this.toObject();
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
