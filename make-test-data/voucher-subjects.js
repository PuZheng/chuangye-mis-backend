#! /usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');
var casing = require('casing');
var entityTypes = require('../const').entityTypes;

knex.transaction(function (trx) {
  var list = [
    ['项目1', 'xm1', entityTypes.CUSTOMER, entityTypes.OWNER, '项目1的说明', true],
    ['项目2', 'xm2', entityTypes.TENANT, entityTypes.OWNER, '项目2的说明', true],
    ['项目3', 'xm3', entityTypes.TENANT, entityTypes.SUPPLIER, '项目3的说明', false],
  ].map(function ([name, acronym, payerType, recipientType, notes, isPublic]) {
    return {
      name,
      acronym,
      payerType,
      recipientType,
      notes,
      isPublic
    };
  });
  return trx.batchInsert('voucher_subjects', casing.snakeize(list));
}).then(function () {
  logger.info('completed');
  knex.destroy();
}, function (e) {
  logger.error(e);
  knex.destroy();
});
