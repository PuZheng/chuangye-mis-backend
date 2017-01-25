#!/usr/bin/env node
/**
 * 注意本脚本需要针对某账期进行单独调用, 不能放在make_test_data.sh中,
 * 为所有的部门生成某帐期支付凭证清单
 * */
var argv = require('yargs').argv;
var knex = require('../knex');
var co = require('co');
var { makeAccountBooks } = require('../account-term');

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
    yield makeAccountBooks(trx, accountTerm.id);
    console.log('明细帐已经生成!');
    knex.destroy();
  });
})
.catch(function (e) {
  console.error(e);
  knex.destroy();
});
