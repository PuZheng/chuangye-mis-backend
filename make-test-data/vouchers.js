#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var casing = require('casing');
var Chance = require('chance');
var moment = require('moment');
var co = require('co');
var R = require('ramda');
var { ROLES } = require('../const');

var chance = new Chance();

co(function *() {
  let voucherTypes = casing.camelize(yield knex('voucher_types').select('*'));
  let voucherSubjects = casing.camelize(
    yield knex('voucher_subjects').whereIn('name', ['应收货款', '应付货款'])
    .select('*')
  );
  let entites = casing.camelize(yield knex('entities').select('*'));
  let cashiers = casing.camelize(
    yield knex('users').where('role', '=', ROLES.CASHIER).select('*')
  );
  let accountTerms = yield knex('account_terms').select('*');

  let rows = R.range(0, 4096).map(function () {
    let voucherType = chance.pickone(voucherTypes);
    let voucherSubject = chance.pickone(voucherSubjects);
    let accountTerm = chance.pickone(accountTerms);
    let [, year, month] = accountTerm.name.match(/(\d{4})-(\d{2})/);
    let date = moment(
      chance.date({ year: Number(year), month: Number(month) - 1 })
    ).format('YYYY-MM-DD');
    let payer = chance.pickone(
      entites.filter(e => e.type == voucherSubject.payerType)
    );
    let recipient = chance.pickone(
      entites.filter(e => e.type == voucherSubject.recipientType)
    );
    return casing.snakeize({
      number: chance.string({ pool: '0123456789', length: 20 }),
      voucherTypeId: voucherType.id,
      accountTermId: accountTerm.id,
      date,
      voucherSubjectId: voucherSubject.id,
      notes: chance.sentence({ words: 5 }),
      payerId: payer.id,
      recipientId: recipient.id,
      creatorId: chance.pickone(cashiers).id,
      amount: chance.integer({ min: 10000, max: 99999 }),
    });
  });
  yield knex.batchInsert('vouchers', rows);
}).then(function () {
  logger.info('vouchers completed');
  knex.destroy();
}, function (e) {
  logger.error(e);
  knex.destroy();
});
