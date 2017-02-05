#! /usr/bin/env node
var knex = require('../knex');
var R = require('ramda');
var logger = require('../logger.js');
var argv = require('yargs').argv;
const casing = require('casing');
const co = require('co');
const Chance = require('chance');

const C = new Chance();

let n = Number(argv.n || 100);

var makeDepartments = function () {
  return knex.transaction(function (trx) {
    return co(function *() {
      let plants = yield trx('plants').then(casing.camelize);
      var rows = R.range(0, n).map(function (i) {
        return {
          name: '车间' + i,
          acronym: 'cj' + i,
          plant_id: C.pickone(plants).id,
        };
      });
      yield trx.batchInsert('departments', rows);
    });
  });
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
