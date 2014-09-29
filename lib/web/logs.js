var morgan = require('morgan');

module.exports = function Logs(verbose) {
  return morgan('dev', {
    skip: verbose ? false : skipSuccesses
  });

  function skipSuccesses(req, res) {
    return res.statusCode < 400;
  }
};
