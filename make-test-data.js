#! /usr/bin/env node
var config = require('./config.js');
var pgp = require('pg-promise')();
var db = pgp(config.get('dbConnection'));
var logger = require('./logger.js');
var roles = require('./roles');

var accounts = [
  ['kj1', 'kj1', roles.ACCOUNTANT],
  ['kj2', 'kj2', roles.ACCOUNTANT],
  ['cn1', 'cn1', roles.ACCOUNTANT],
  ['cn2', 'cn2', roles.ACCOUNTANT],
];

var invoiceTypes = [
  ['进项增值税', 'supplier', 'tenant', true, 'inbound'],
  ['销项增值税', 'tenant', 'supplier', true, 'outbound'],
  ['普通发票', '', 'owner', false, ''],
];

var accountTerms = [
  '2016-04',
  '2016-05',
  '2016-06',
  '2016-07',
  '2016-08',
];

var entities = [
  { name: '承包人1', acronym: 'cbr1', type: 'tenant' },
  { name: '承包人2', acronym: 'cbr2', type: 'tenant' },
  { name: '承包人3', acronym: 'cbr3', type: 'tenant' },
  { name: '承包人4', acronym: 'cbr3', type: 'tenant' },
  { name: '业主', acronym: 'yz', type: 'owner' },
  { name: '客户1', acronym: 'kh1', type: 'customer' },
  { name: '客户2', acronym: 'kh2', type: 'customer' },
  { name: '客户3', acronym: 'kh3', type: 'customer' },
  { name: '供应商1', acronym: 'gys1', type: 'supplier' },
  { name: '供应商2', acronym: 'gys2', type: 'supplier' },
];

var materialSubjects = [
  { name: '原材料1', unit: 'kg' },
  { name: '原材料2', unit: '吨' },
  { name: '原材料3', unit: '桶' },
  { name: '产成品1', unit: '箱' },
  { name: '产成品2', unit: 'kg' },
  { name: '产成品3', unit: '吨' },
];

db.tx(function (t) {
  return t.batch([
    ...accounts.map(),
    ...invoiceTypes.map(function (it) {
      return t.none(
        `
        INSERT INTO invoice_types (name, vendor_type, purchaser_type, is_vat, material_type) values
        ($1, $2, $3, $4, $5)
        `,
        it
      );
    }),
    ...accountTerms.map(function (it) {
      return t.none(
        `
        INSERT INTO  account_terms (name) values ($1)
        `,
        [it]
      );
    }),
    ...entities.map(function (it) {
      return t.none(
        `
        INSERT INTO entities (name, type, acronym) values
        ($<name>, $<type>, $<acronym>)
        `,
        it
      );
    }),
    ...materialSubjects.map(function (it) {
      return t.none(
        `
        INSERT INTO material_subjects (name, unit) values
        ($<name>, $<unit>)
        `,
        it
      );
    }),
    ...materialNotes.map(function (it) {
      return t.none(
        `
        INSERT INTO material_notes ()
        `
      )
    }),
    ...invoices.map(function (it) {

    }),
  ]);
}).then(function () {
  logger.info('completed');
  pgp.end();
}).catch(function (e) {
  logger.error(e);
  pgp.end();
});
