#! /usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');
var casing = require('casing');

knex.transaction(function (trx) {
  var list = [
    { name: '项目1', acronym: 'xm1', payerType: 'customer', recipientType: 'tenant', notes: '项目1的说明', isPublic: true },
    { name: '项目2', acronym: 'xm2', payerType: 'tenant', recipientType: 'owner', notes: '项目2的说明', isPublic: true },
    { name: '项目3', acronym: 'xm3', payerType: 'tenant', recipientType: 'supplier', notes: '项目3的说明', isPublic: false },
  ];
  return trx.batchInsert('voucher_subjects', casing.snakeize(list));
}).then(function () {
  logger.info('completed');
  knex.destroy();
}, function (e) {
  logger.error(e);
  knex.destroy();
});
