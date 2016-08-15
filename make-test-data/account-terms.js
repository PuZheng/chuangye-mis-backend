#! /usr/bin/env node
var config = require('../config.js');
var pgp = require('pg-promise')();
var db = pgp(config.get('dbConnection'));
var logger = require('../logger.js');
var roles = require('../roles');


var makeAccountTerms = function () {
  var accountTerms = [
    '2016-04',
    '2016-05',
    '2016-06',
    '2016-07',
    '2016-08',
  ];
  return db.tx(function (t) {
    t.batch(accountTerms.map(function (it) {
      return t.none(
        `
        INSERT INTO  account_terms (name) values ($1)
        `,
        [it]
      );
    }));
  });
};

module.exports = makeAccountTerms;

if (require.main === module) {
  makeAccountTerms().then(function () {
    logger.info('completed');
    pgp.end();
  }, function (e) {
    logger.error(e);
    pgp.end();
  });
}
