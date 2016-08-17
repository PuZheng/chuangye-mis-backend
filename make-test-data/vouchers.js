#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var casing = require('casing');
var Chance = require('chance');
var moment = require('moment');
var co = require('co');
var R = require('ramda');

var chance = new Chance();

co(function *() {
  let voucherTypes = casing.camelize(yield knex('voucher_types').select('*'));
  let voucherSubjects = casing.camelize(yield knex('voucher_subjects').select('*'));
  let entites = casing.camelize(yield knex('entities').select('*'));
  let rows = R.range(0, 1024).map(function () {
    let voucherType = chance.pickone(voucherTypes);
    let voucherSubject = chance.pickone(voucherSubjects);
    let payer = chance.pickone(entites.filter(e => e.type == voucherSubject.payerType));
    let recipient = chance.pickone(entites.filter(e => e.type == voucherSubject.recipientType));
    return casing.snakeize({
      number: chance.string(),
      voucherTypeId: voucherType.id,
      date: moment(chance.date({ year: 2016 })).format('YYYY-MM-DD'),
      voucherSubjectId: voucherSubject.id,
      isPublic: chance.bool(),
      notes: chance.sentence({ words: 5 }),
      payerId: payer.id, 
      recipientId: recipient.id
    });
  });
  yield knex.batchInsert('vouchers', rows);
}).then(function () {
  logger.info('completed');
  knex.destroy();
}, function (e) {
  logger.error(e);
  knex.destroy();
});
