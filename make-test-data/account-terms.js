#! /usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');


var makeAccountTerms = function () {
  var accountTerms = [
    ['2016-04', true],
    ['2016-05', true],
    ['2016-06', true],
    ['2016-07', true],
    ['2016-08', true],
    ['2016-09', false],
    ['2016-10', false],
  ];

  return knex.batchInsert('account_terms', accountTerms.map(
    ([name, closed]) => ({ name, closed })
  ));
};

module.exports = makeAccountTerms;

if (require.main === module) {
  makeAccountTerms().then(function () {
    logger.info('account terms completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
