#! /usr/bin/env node
var knex = require('../knex');
var roles = require('../const').roles;
var logger = require('../logger.js');
var R = require('ramda');

var makeUsers = function () {

  var users = [
    ['kj1', 'kj1', roles.ACCOUNTANT],
    ['kj2', 'kj2', roles.ACCOUNTANT],
    ['cn1', 'cn1', roles.CASHIER],
    ['cn2', 'cn2', roles.CASHIER],
  ];
  return knex('users')
  .insert(R.map(function (a) {
    return {
      username: a[0],
      password: knex.raw('crypt(?, gen_salt(\'md5\'))', [a[1]]),
      role: a[2]
    };
  })(users));
};

if (require.main === module) {
  makeUsers().then(function () {
    logger.info('users completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}

module.exports = makeUsers;
