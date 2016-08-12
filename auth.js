var koa = require('koa');
var router = require('koa-router')();
var koaBody = require('koa-body')();
var logger = require('./logger.js');
var db = require('./db.js');
var sign = require('./jwt-sign.js');

router.post('/login', koaBody, function *(next) {
  let username = this.request.body.username;
  let password = this.request.body.password;
  let user = yield db.query(
    `
    SELECT id, username FROM users WHERE password = crypt($1, password) and username = $2;
    `,
    [password, username]
  );
  if (!user) {
    this.body = {
      username: '不存在该用户或者密码不正确',
    };
    this.status = 403;
  }
  var token = yield sign(user);
  user.token = token;
  this.body = user;
  yield next;
});

module.exports = {
    // app: koa().use(router.routes()).use(router.allowedMethods())
};
