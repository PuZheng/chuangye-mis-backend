#! /usr/bin/env node
var config = require('./config.js');
var logger = require('./logger.js');
var roles = require('./roles');
var knex = require('./knex');
var co = require('co');
var cofy = require('cofy');

var admin = config.get('admin');


var trx;
co(function *() {
  trx = yield cofy.fn(knex.transaction, false, knex)();
  yield trx.raw(
    `
    INSERT INTO users (username, password, role) VALUES
    (:username, crypt(:password, gen_salt('md5')), :role);
    `,
    {
      username: admin.username,
      password: admin.password,
      role: roles.ADMIN
    } 
  );
  yield trx.into('voucher_types').insert([{
    name: '现金凭证'
  }, {
    name: '银行凭证'
  }]);
}).then(function () {
  trx.commit();
  logger.info('completed');
  knex.destroy();
}, function (e) {
  trx.rollback();
  logger.error(e);
  knex.destroy();
});
