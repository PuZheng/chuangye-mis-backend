var fs = require('mz/fs');
var config = require('./config.js');
var jwt = require('jsonwebtoken');
var privateKey;

module.exports = function sign(obj) {
  let p;
  if (privateKey) {
    p = Promise.resolve(privateKey);
  } else {
    p = fs.readFile(config.get('privateKey')).then(function (pk) {
      privateKey = pk;
      return pk;
    });
  }
  return p.then(key => jwt.sign(obj, privateKey, {
      algorithm: 'RS256'
    }));
};
