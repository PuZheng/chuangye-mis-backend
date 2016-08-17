#! /usr/bin/env node
var config = require('../config.js');
var pgp = require('pg-promise')();
var db = pgp(config.get('dbConnection'));
var roles = require('../roles');
var logger = require('../logger.js');

var makeAccounts = function () {

  var accounts = [
    ['kj1', 'kj1', roles.ACCOUNTANT],
    ['kj2', 'kj2', roles.ACCOUNTANT],
    ['cn1', 'cn1', roles.CASHIER],
    ['cn2', 'cn2', roles.CASHIER],
  ];
  return db.tx(function (t) {
    return t.batch(accounts.map(function (a) {
      return t.none(
        `
        INSERT INTO users (username, password, role) VALUES 
        ($1, crypt($2, gen_salt('md5')), $3)
        `,
        a
      );
    }));
  });
};

if (require.main === module) {
  makeAccounts().then(function () {
    logger.info('completed');
    pgp.end();
  }, function (e) {
    logger.error(e);
    pgp.end();
  });
};

module.exports = makeAccounts;
