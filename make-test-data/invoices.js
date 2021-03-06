#! /usr/bin/env node
var logger = require('../logger.js');
var Chance = require('chance');
var R = require('ramda');
var casing = require('casing');
var knex = require('../knex');
var co = require('co');
var { ROLES } = require('../const');
var argv = require('yargs').argv;
let n = Number(argv.n || 8192);

var makeInvoices = function () {
  let chance = new Chance();
  return co(function *() {
    let invoiceTypes = casing.camelize(yield knex('invoice_types').select('*'));
    let entities = casing.camelize(yield knex('entities').select('*'));
    let accountTerms = casing.camelize(yield knex('account_terms').select('*'));
    let accountants = yield knex('users').select('*')
    .where('role', ROLES.ACCOUNTANT);
    let rows = R.range(0, n).map(function () {
      let invoiceType = chance.pickone(invoiceTypes);
      let accountTerm = chance.pickone(accountTerms);
      let [year, month] = accountTerm.name.split('-');
      let vendor = invoiceType.vendorType?
      chance.pickone(entities.filter(function (it) {
        return it.type == invoiceType.vendorType;
      })): {};
      let purchaser = invoiceType.purchaserType?
      chance.pickone(entities.filter(function (it) {
        return it.type == invoiceType.purchaserType;
      })): {};
      return {
        invoice_type_id: invoiceType.id,
        date: function () {
          return year + '-' + (month - 1) + '-' +
            chance.integer({ min: 1, max: 30 });
        }(),
        number: chance.string({ pool: '0123456789', length: 20 }),
        account_term_id: accountTerm.id,
        is_vat: chance.bool(),
        vendor_id: vendor.id,
        purchaser_id: purchaser.id,
        notes: chance.sentence({ words: 10 }),
        creator_id: chance.pickone(accountants).id,
        amount: chance.integer({ min: 1000, max: 50000 }),
        tax_rate: R.ifElse(
          R.propEq('name', '普通发票'),
          R.always(undefined),
          R.always(17)
        )(invoiceType),
      };
    });
    yield knex.batchInsert('invoices', rows);
  });
};

if (require.main === module) {
  makeInvoices().then(function () {
    logger.info('invoices completed');
    knex.destroy();
  }, function (e) {
    logger.error(e.stack);
    knex.destroy();
  });
}
