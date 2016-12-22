#!/usr/bin/env node
/**
 * 注意本脚本需要针对某账期进行单独调用, 不能放在make_test_data.sh中
 * */
var argv = require('yargs').argv;
var knex = require('../knex');
var co = require('co');
var chargeBillDef = require('../charge-bill/charge-bill-def');
var R = require('ramda');
var chance = require('chance');

var C = new chance();

if (!argv.t) {
  console.log('请指定的账期');
}

co(function *() {
  let [accountTerm] = yield knex('account_terms').where({ name: argv.t })
  .select('*');
  if (!accountTerm) {
    console.log('账期不存在');
  }
  let { sheets } = yield chargeBillDef();
  for (let { grid } of sheets) {
    for (let row of grid.filter(R.pathEq(['data', 'tag'], 'meter'))) {
      row.cells.filter(R.pathEq(['data', 'tag'], 'meter-reading'))
      .forEach(function (cell) {
        cell.val = cell.data.lastAccountTermValue +
          C.integer({ min: 10, max: 200 });
      });
    }
  }
  yield knex('charge_bills').insert({
    account_term_id: accountTerm.id,
    def: { sheets },
  });
  console.log('账期' + argv.t + '创建完毕');
  knex.destroy();
})
.catch(function (e) {
  console.error(e);
  knex.destroy();
});
