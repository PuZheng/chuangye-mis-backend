#! /usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');


var makeAccountTerms = function () {
  var accountTerms = [
    ['2016-11', false],
    ['2016-12', false],
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
