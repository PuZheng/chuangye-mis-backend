var fs = require('mz/fs');
var config = require('./config.js');
var jwt = require('jsonwebtoken');
var privateKey;

module.exports = function sign(obj) {
  return Promise.resolve(
    privateKey || fs.readFile(config.get('privateKey'))
    .then(function (pk) {
      privateKey = pk;
      return pk;
    })
  ).then(key => jwt.sign(obj, key, {
    algorithm: 'RS256'
  }));
};
