#!/usr/bin/env node
/**
 * 注意本脚本需要针对某账期进行单独调用, 不能放在make_test_data.sh中,
 * 通过某帐期所有的预支付记录
 * */
var argv = require('yargs').argv;
var knex = require('../knex');
var co = require('co');
var { sm } = require('../payment-record');
var casing = require('casing');
var {
  ROLES: { CASHIER },
  PAYMENT_RECORD_STATES: { UNPROCESSED },
  PAYMENT_RECORD_ACTIONS: { PASS }
} = require('../const');

if (!argv.t) {
  console.log('请指定帐期');
  process.exit(-1);
}

knex.transaction(function (trx) {
  return co(function *() {
    let [accountTerm] = yield knex('account_terms').where({ name: argv.t });
    if (!accountTerm) {
      console.log('帐期不存在!');
      return;
    }
    let user = yield trx('users').where({ role: CASHIER }).first('*');
    let paymentRecords = yield trx('payment_records')
    .where({ account_term_id: accountTerm.id, status: UNPROCESSED })
    .select('*').then(casing.camelize);
    for (let pr of paymentRecords) {
      yield sm.bundle(pr).state(UNPROCESSED).perform(PASS, user.id);
    }
    console.log('所有的预支付记录已经通过');
    knex.destroy();
  });
})
.catch(function (e) {
  console.error(e);
  knex.destroy();
});
