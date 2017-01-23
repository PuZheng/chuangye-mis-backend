#!/usr/bin/env node
var argv = require('yargs').argv;
var co = require('co');
var knex = require('../knex');
var casing = require('casing');
var { createDepartmentChargeBills, updateMeterReadings } = require('../charge-bill');

if (!argv.t) {
  console.log('请指定账期');
  process.exit(-1);
}

knex.transaction(function (trx) {
  return co(function *() {
    let [accountTerm] = yield trx('account_terms').where({ name: argv.t })
    .select('*').then(casing.camelize);
    if (!accountTerm) {
      console.log('inexistent account term: ' + argv.t);
      return;
    }
    let [chargeBill] = yield trx('charge_bills').where({
      account_term_id: accountTerm.id
    }).select('*').then(casing.camelize);
    if (!chargeBill) {
      console.log('charge bill hasn\'t been generated!');
      return;
    }
    yield createDepartmentChargeBills(trx, chargeBill);
    yield updateMeterReadings(trx, chargeBill);
    yield trx('charge_bills').update('closed', true).where({id: chargeBill.id});
    console.log('account term ' + argv.t + ' has been closed');
    knex.destroy();
  })
  .catch(function (err) {
    console.error(err);
    knex.destroy();
  });
});
