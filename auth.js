var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var knex = require('./knex');;
var sign = require('./jwt-sign');
var co = require('co');
var R = require('ramda');
var policies = require('./policies');
var loginRequired = require('./login-required');
var casing = require('casing');

router.post('/login', restify.bodyParser(), function loginCb(req, res, next) {

  let { username, password } = req.body;
  co(function *() {
    let [user] = yield knex('users')
    .whereRaw('password = crypt(?, password)', [password])
    .where('username', username)
    .select('*');
    if (!user) {
      return next(new restify.ForbiddenError('不存在该用户或者密码不正确'));
    }
    if (!user.enabled) {
      return next(new restify.ForbiddenError('该帐号已经锁定'));
    }
    user = casing.camelize(user);
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
