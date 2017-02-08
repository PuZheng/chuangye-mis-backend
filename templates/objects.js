#! /usr/bin/env node
const knex = require('../knex');
const argv = require('yargs').argv;
const logger = require('../logger.js');
const R = require('ramda');

let n = Number(argv.n || 9999);

const make<%= capitalize(camelize(表名称)) %> = function () {
  var rows = R.range(0, n).map(function (i) {
    return {
    };
  });
  return knex.batchInsert('<%= 表名称 %>', rows);
};

module.exports = make<%= capitalize(camelize(表名称)) %>;

if (require.main === module) {
  logger.info('creating <%= 表名称 %>...');
  make<%= capitalize(camelize(表名称)) %>().then(function () {
    logger.info('DONE');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
