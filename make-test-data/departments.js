#! /usr/bin/env node
var knex = require('../knex');
var R = require('ramda');
var logger = require('../logger.js');
var argv = require('yargs').argv;

let n = Number(argv.n || 100);

var makeDepartments = function () {
  var rows = R.range(0, n).map(function (i) {
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
    logger.info('departments completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
