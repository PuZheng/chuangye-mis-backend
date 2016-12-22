#!/usr/bin/env node
/**
 * 注意本脚本需要针对某账期进行单独调用, 不能放在make_test_data.sh中
 * */
var { createDepartmentChargeBills } = require('../charge-bill');
var co = require('co');
var knex = require('../knex');
var casing = require('casing');
var logger = require('../logger');
// var prettyjson = require('prettyjson');

var argv = require('yargs').argv;

if (!argv.t) {
  console.log('请指定账期');
}

knex.transaction(function (trx) {
  return co(function *() {
    let [chargeBill] = yield trx('charge_bills')
    .join('account_terms', 'account_terms.id', 'charge_bills.account_term_id')
    .where('account_terms.name', argv.t)
    .select('charge_bills.*')
    .then(casing.camelize);
    if (!chargeBill) {
      console.log('账期' + argv.t + '不存在');
    }
    yield createDepartmentChargeBills(trx, chargeBill);
  });
})
.then(function () {
  logger.info('department charge bills created!');
  knex.destroy();
})
.catch(function (e) {
  console.error(e);
  knex.destroy();
});


