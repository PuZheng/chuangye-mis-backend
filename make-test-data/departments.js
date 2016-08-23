#! /usr/bin/env node
var knex = require('../knex');
var R = require('ramda');
var logger = require('../logger.js');

var makeDepartments = function () {
  var rows = R.range(0, 100).map(function (i) {
    return {
      name: '车间' + i,
      acronym: 'cj' + i,
    };
  });
  return knex.batchInsert('departments', rows);
};

module.exports = makeDepartments;

if (require.main === module) {
  makeDepartments().then(function () {
    logger.info('completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
