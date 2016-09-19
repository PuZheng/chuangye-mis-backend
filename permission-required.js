var restify = require('restify');
var R = require('ramda');
var could = require('./auth').could;

var permissionRequired = function (...needs) {
  return function (req, res, next) {
    let _could = R.curry(could)(req.user);
    if (needs.every(_could)) {
      next();
    } else {
      next(new restify.ForbiddenError(
        '你没有如下的权限中的一项或者多项: ' + needs.join(', ')));
    }
  };
};

module.exports = permissionRequired;
