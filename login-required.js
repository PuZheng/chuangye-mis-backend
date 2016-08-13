var jwt = require('restify-jwt');
var fs = require('fs');
var publicKey;
var config = require('./config');

module.exports = function (req, res, next) {
  (function (after) {
    if (!publicKey) {
      fs.readFile(config.get('publicKey'), function (err, data) {
        if (err) {
          return next(err);
        }
        publicKey = data;
        after(publicKey);
      });
    } else {
      after(publicKey);
    }
  })(function (publicKey) {
    jwt({secret: publicKey})(req, res, next);
  });
};
