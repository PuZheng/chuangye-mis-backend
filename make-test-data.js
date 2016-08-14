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

db.tx(function (t) {
  return t.batch([
    ...accounts.map(function (a) {
      return t.none(
        `
        INSERT INTO users (username, password, role) VALUES 
        ($1, crypt($2, gen_salt('md5')), $3)
        `,
        a
      );
    }),
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
  ]);
}).then(function () {
  logger.info('completed');
  pgp.end();
}).catch(function (e) {
  logger.error(e);
  pgp.end();
});
