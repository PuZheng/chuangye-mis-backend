#! /usr/bin/env node
var config = require('../config.js');
var pgp = require('pg-promise')();
var db = pgp(config.get('dbConnection'));
var logger = require('../logger.js');
var Chance = require('chance');
var R = require('ramda');
var casing = require('casing');

var makeInvoices = function () {
  let chance = new Chance();
  return Promise.all([
    db.query(`select * from invoice_types;`),
    db.query('select * from entities'),
    db.query('select * from account_terms')
  ]).then(function (data) {
    return data.map(function (it) {
      return casing.camelize(it);
    });
  }).then(function ([invoiceTypes, entities, accountTerms]) {
    let invoices = [];
    for (let i = 0; i < 256; ++i) {
      let invoiceType = chance.pickone(invoiceTypes);
      let accountTerm = chance.pickone(accountTerms);
      let [year, month] = accountTerm.name.split('-');
      let vendor = invoiceType.vendorType? chance.pickone(entities.filter(function (it) {
        return it.type == invoiceType.vendorType;
      })): {};
      let purchaser = invoiceType.purchaserType? chance.pickone(entities.filter(function (it) {
        return it.type == invoiceType.purchaserType;
      })): {};

      invoices.push({
        invoice_type_id: invoiceType.id,
        date: function () {
          return year + '-' + (month - 1) + '-' + chance.integer({ min: 1, max: 30 });
        }(),
        number: chance.string(),
        account_term_id: accountTerm.id,
        is_vat: chance.bool(),
        vendor_id: vendor.id,
        purchaser_id: purchaser.id,
        notes: chance.sentence()
      });
    }
    return db.tx(function (t) {
      return t.batch(invoices.map(function (it) {
        return db.none(
          `
          INSERT INTO invoices(invoice_type_id, date, number, account_term_id, is_vat, vendor_id, purchaser_id, notes) VALUES
          ($[invoice_type_id], $[date], $[number], $[account_term_id], $[is_vat], $[vendor_id], $[purchaser_id], $[notes])
          `,
          it);
      }));
    });
  });
};

if (require.main === module) {
  makeInvoices().then(function () {
    logger.info('completed');
    pgp.end();
  }, function (e) {
    logger.error(e.stack);
    pgp.end();
  });
}
