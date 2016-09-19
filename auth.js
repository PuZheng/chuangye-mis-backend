var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var db = require('./db.js');
var sign = require('./jwt-sign.js');
var co = require('co');
var R = require('ramda');
var policies = require('./policies');
var loginRequired = require('./login-required');

router.post('/login', restify.bodyParser(), function loginCb(req, res, next) {

  let { username, password } = req.body;
  co(function *() {
    let user = yield db.oneOrNone(
      `
      SELECT id, username, role FROM users WHERE password = crypt($1, password) and username = $2;
      `,
      [password, username]
    );
    if (!user) {
      return next(new restify.ForbiddenError('不存在该用户或者密码不正确'));
    }
    user.token = yield sign(user);
    res.json(user);
    next();
  }).catch(function (error) {
    logger.error(error);
    next(error);
  });
});

var could = function could(user, need) {
  return policies[user.role].has(need);
};

var couldCb = function couldCb(req, res, next) {
  let tests = req.body.tests;
  res.json({
    data: tests.map(t => R.isArrayLike(t)? t: [t]).map(t => could(req.user, ...t))
  });
  next();
};

router.post('/could', loginRequired, restify.bodyParser(), couldCb);

module.exports = {
  router, could
};
