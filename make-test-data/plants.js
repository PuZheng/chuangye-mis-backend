#! /usr/bin/env node
const knex = require('../knex');
const argv = require('yargs').argv;
const logger = require('../logger.js');
const R = require('ramda');
const Chance = require('chance');

const C = new Chance();

let n = Number(argv.n || 16);

const makePlants = function () {
  var rows = R.range(0, n).map(function (i) {
    return {
      name: '建筑' + i,
      area: C.floating({ fixed: 2 }),
    };
  });
  return knex.batchInsert('plants', rows);
};

module.exports = makePlants;

if (require.main === module) {
  logger.info('creating plants...');
  makePlants().then(function () {
    logger.info('DONE');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
