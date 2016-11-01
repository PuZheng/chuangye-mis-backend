#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var Chance = require('chance');
var C = new Chance();
var R = require('ramda');
var { storeOrderTypes, storeOrderDirections } = require('../const');
var co = require('co');
var casing = require('casing');

var makeStoreOrders = function () {
  return co(function *() {
    let storeSubjects = yield knex('store_subjects').select('*');
    let tenants = yield knex('tenants').select('*');
    let invoices = yield knex('invoices')
    .select('*')
    .then(casing.camelize);
    for (let invoice of invoices) {
      [invoice.invoiceType] = yield knex('invoice_types')
      .where('id', invoice.invoiceTypeId)
      .select('*')
      .then(casing.camelize);
    }
    let rows = R.range(0, 500).map(function () {
      let direction = C.pickone(R.values(storeOrderDirections));
      let type = C.pickone(R.values(storeOrderTypes));
      let quantity = C.integer({ min: 1, max: 1000 });
      let unit_price;
      if ((direction == storeOrderDirections.INBOUND && type == storeOrderTypes.MATERIAL) ||
         (direction === storeOrderDirections.OUTBOUND && type == storeOrderTypes.PRODUCT)) {
        unit_price = C.integer({ min: 1, max: 1000 });

      }
      let invoice;
      if (direction == storeOrderDirections.INBOUND && type == storeOrderTypes.MATERIAL) {
        invoice = C.pick(invoices.filter(function (it) {
          return it.invoiceType.name == '进项增值税';
        }));
      }
      if (direction === storeOrderDirections.OUTBOUND && type == storeOrderTypes.PRODUCT) {
        invoice = C.pick(invoices.filter(function (it) {
          return it.invoiceType.name == '销项增值税';
        }));
      }
      return {
        store_subject_id: C.pickone(storeSubjects).id,
        quantity,
        unit_price,
        direction,
        type,
        created: C.date({ year: 2016, month: C.pickone([5, 6, 7, 8]) }),
        tenant_id: C.pickone(tenants).id,
        invoice_id: invoice && invoice.id,
      };
    });
    yield knex.batchInsert('store_orders', rows);
    // adjust invoices' amount
    for (var invoice of invoices) {
      if (invoice.invoiceType === '普通发票') {
        continue;
      }
      let sos = yield knex('store_orders').where('invoice_id', invoice.id).select('*');
      let amount = R.sum(sos.map(function ({ quantity, unit_price }) {
        return quantity * unit_price;
      }));
      if (invoice.amount != amount) {
        yield knex('invoices').where('id', invoice.id).update({
          amount,
        });
      }
    }
  });
};

module.exports = makeStoreOrders;

if (require.main === module) {
  makeStoreOrders()
  .then(function () {
    logger.info('store orders completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
