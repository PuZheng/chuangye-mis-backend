#! /usr/bin/env node
var config = require('../config.js');
var pgp = require('pg-promise')();
var db = pgp(config.get('dbConnection'));
var logger = require('../logger.js');
var roles = require('../roles');

var makeInvoiceTypes = function () {
  var invoiceTypes = [
    ['进项增值税', 'supplier', 'tenant', true, 'inbound'],
    ['销项增值税', 'tenant', 'supplier', true, 'outbound'],
    ['普通发票', '', 'owner', false, ''],
  ];
  return db.tx(function (t) {
    return t.batch(invoiceTypes.map(function (it) {
      return t.none(
        `
        INSERT INTO invoice_types (name, vendor_type, purchaser_type, is_vat, material_type) values
        ($1, $2, $3, $4, $5)
        `,
        it
      );
    }));
  });
};

module.exports = makeInvoiceTypes;

if (require.main === module) {
  makeInvoiceTypes().then(function () {
    logger.info('completed');
    pgp.end();
  }, function (e) {
    logger.error(e);
    pgp.end();
  });

}

