#! /usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');
var { ENTITY_TYPES } = require('../const');
var co = require('co');
var R = require('ramda');
var {sprintf} = require('sprintf-js');

var makeEntities = function () {
  var entities = [
    { name: '业主', acronym: 'yz', type: ENTITY_TYPES.OWNER },
    { name: '客户1', acronym: 'kh1', type: ENTITY_TYPES.CUSTOMER },
    { name: '客户2', acronym: 'kh2', type: ENTITY_TYPES.CUSTOMER },
    { name: '客户3', acronym: 'kh3', type: ENTITY_TYPES.CUSTOMER },
    { name: '供应商1', acronym: 'gys1', type: ENTITY_TYPES.SUPPLIER },
    { name: '供应商2', acronym: 'gys2', type: ENTITY_TYPES.SUPPLIER },
  ];
  return knex.batchInsert('entities', entities);
};

var makeOwner = function makeOwner(trx) {
  return trx.insert({ name: '业主', acronym: 'yz', type: ENTITY_TYPES.OWNER })
  .into('entities');
};

var makeCustomers = function makeCustomers(trx) {
  return trx.batchInsert('entities', R.range(1, 3001).map(function (n) {
    n = sprintf('%04d', n);
    return { name: '客户' + n, acronym: 'kh' + n, type: ENTITY_TYPES.CUSTOMER };
  }));
};

var makeSuppliers = function makeSuppliers(trx) {
  return trx.batchInsert('entities', R.range(1, 3001).map(function (n) {
    return {
      name: '供应商' + n,
      acronym: 'gys' + n,
      type: ENTITY_TYPES.SUPPLIER
    };
  }));
};

module.exports = makeEntities;

if (require.main === module) {
  knex.transaction(function (trx) {
    return co(function *() {
      try {
        yield makeOwner(trx);
        yield makeCustomers(trx);
        yield makeSuppliers(trx);
        logger.info('entities completed');
      } catch (e) {
        logger.error(e);
      } finally {
        knex.destroy();
      }
    });
  });
}
