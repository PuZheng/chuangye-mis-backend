var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var db = require('./db.js');
var sign = require('./jwt-sign.js');
var co = require('co');

router.post('/login', restify.bodyParser(), function (req, res, next) {

  let { username, password } = req.params;
  co(function *() {
    let user = yield db.oneOrNone(
      `
      SELECT id, username FROM users WHERE password = crypt($1, password) and username = $2;
      `,
      [password, username]
    );
    if (!user) {
      return next(new restify.errors.ForbiddenError('不存在该用户或者密码不正确'));
    }
    user.token = yield sign(user);
    res.json(user);
    next();
  }).catch(function (error) {
    logger.error(error);
    next(error);
  });
});

module.exports = router;
