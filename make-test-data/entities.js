#! /usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');
var entityTypes = require('../const').entityTypes;

var makeEntities = function () {

  var entities = [
    { name: '业主', acronym: 'yz', type: entityTypes.OWNER },
    { name: '客户1', acronym: 'kh1', type: entityTypes.CUSTOMER },
    { name: '客户2', acronym: 'kh2', type: entityTypes.CUSTOMER },
    { name: '客户3', acronym: 'kh3', type: entityTypes.CUSTOMER },
    { name: '供应商1', acronym: 'gys1', type: entityTypes.SUPPLIER },
    { name: '供应商2', acronym: 'gys2', type: entityTypes.SUPPLIER },
  ];
  return knex.batchInsert('entities', entities);
};

module.exports = makeEntities;

if (require.main === module) {
  makeEntities().then(function () {
    logger.info('completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
