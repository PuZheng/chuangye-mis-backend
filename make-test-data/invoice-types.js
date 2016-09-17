#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger.js');

var makeInvoiceTypes = function () {
  var invoiceTypes = [
    ['进项增值税', 'supplier', 'tenant', true, 'inbound'],
    ['销项增值税', 'tenant', 'supplier', true, 'outbound'],
    ['普通发票', '', 'owner', false, ''],
  ].map(function ([name, vendor_type, purchaser_type, is_vat, material_type]) {
    return {
      name,
      vendor_type,
      purchaser_type,
      is_vat, 
      material_type
    };
  });
  return knex.batchInsert('invoice_types', invoiceTypes);
};

module.exports = makeInvoiceTypes;

if (require.main === module) {
  makeInvoiceTypes().then(function () {
    logger.info('completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });

}

