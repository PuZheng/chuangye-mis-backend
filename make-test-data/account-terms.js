#! /usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');


var makeAccountTerms = function () {
  var accountTerms = [
    ['2016-04', false],
    ['2016-05', false],
    ['2016-06', false],
    ['2016-07', false],
    ['2016-08', false],
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
