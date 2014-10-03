var mongoose = require('mongoose');
var timestamps = require('mongoose-timestamp');
var crypto = require('crypto');
var logger = require('logfmt');
var Promise = require('promise');
var summarize = require('summarize');
var superagent = require('superagent');
var _ = require('lodash');

var STATES = ['pending', 'complete', 'failed'];

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

    scrape: function(id, url) {
      return new Promise(function(resolve, reject) {
        var Article = this;

        superagent
          .get(url)
          .on('error', reject)
          .end(onResponse);

        function onResponse(res) {
          var summary = summarize(res.text, 10);
          if (!summary.ok) return reject(new UnableToScrape());
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
            .map(toUser)
            .sort(byVotes));
        });
      }.bind(this));

      function toUser(article) {
        return article.forUser(userId);
      }

      function byVotes(a, b) {
        return b.voteCount - a.voteCount;
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

    voteFor: function(articleId, userId) {
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
    }
  };

  var Article = connection.model('Article', Schema);
  return Article;
};
