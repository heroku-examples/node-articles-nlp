function ArticleNotFound() {
  Error.call(this);
  Error.captureStackTrace(this, ArticleNotFound);
  this.name = 'ArticleNotFound';
  this.message = 'Article Not Found';
}

ArticleNotFound.prototype = Object.create(Error.prototype);

function VoteNotAllowed() {
  Error.call(this);
  Error.captureStackTrace(this, VoteNotAllowed);
  this.name = 'VoteNotAllowed';
  this.message = 'Vote Not Allowed';
}

VoteNotAllowed.prototype = Object.create(Error.prototype);

function ScrapeFailed() {
  Error.call(this);
  Error.captureStackTrace(this, ScrapeFailed);
  this.name = 'ScrapeFailed';
  this.message = 'Scrape Failed';
}

ScrapeFailed.prototype = Object.create(Error.prototype);

module.exports = {
  ArticleNotFound: ArticleNotFound,
  VoteNotAllowed: VoteNotAllowed,
  ScrapeFailed: ScrapeFailed
};
