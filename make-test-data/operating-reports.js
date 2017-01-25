#!/usr/bin/env node
/**
 * 注意本脚本需要针对某账期进行单独调用, 不能放在make_test_data.sh中,
 * 为所有的部门生成某帐期运营报告
 * */
var argv = require('yargs').argv;
var knex = require('../knex');
var co = require('co');
var { makeOperatingReports } = require('../account-term');

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
    yield makeOperatingReports(trx, accountTerm.id);
    console.log('运营报告已经生成!');
    knex.destroy();
  });
})
.catch(function (e) {
  console.error(e);
  knex.destroy();
});
