#! /usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');


var makeAccountTerms = function () {
  var accountTerms = [
    '2016-04',
    '2016-05',
    '2016-06',
  ];

  return knex.batchInsert('account_terms', accountTerms.map(function (at) {
    return {
      name: at,
    };
  }));
};

module.exports = makeAccountTerms;

if (require.main === module) {
  makeAccountTerms().then(function () {
    logger.info('completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
