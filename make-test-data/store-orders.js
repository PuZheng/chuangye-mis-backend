#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var Chance = require('chance');
var C = new Chance();
var R = require('ramda');
var { ENTITY_TYPES, STORE_SUBJECT_TYPES, STORE_ORDER_DIRECTIONS } =
  require('../const');
var co = require('co');
var casing = require('casing');
var moment = require('moment');

var makeStoreOrders = function () {
  return co(function *() {
    let storeSubjects = yield knex('store_subjects').select('*');
    let departments = yield knex('departments').select('*');
    let invoices = yield knex('invoices').select('*').then(casing.camelize);
    let entities = yield knex('entities').select('*').then(casing.camelize);
    for (let invoice of invoices) {
      [invoice.invoiceType] = yield knex('invoice_types')
      .where('id', invoice.invoiceTypeId)
      .select('*')
      .then(casing.camelize);
    }
    let accountTerms = yield knex('account_terms').select('*');
    let rows = R.range(0, 500).map(function () {
      let storeSubject = C.pickone(storeSubjects);
      let direction = C.pickone(R.values(STORE_ORDER_DIRECTIONS));
      let quantity = C.integer({ min: 1, max: 1000 });
      let unit_price = C.integer({ min: 1, max: 1000 });
      let invoice;
      if (direction == STORE_ORDER_DIRECTIONS.INBOUND &&
          storeSubject.type == STORE_SUBJECT_TYPES.MATERIAL) {
        invoice = C.pickone(invoices.filter(
          R.pathEq(['invoiceType', 'name'], '进项增值税')
        ));
      }
      if (direction === STORE_ORDER_DIRECTIONS.OUTBOUND &&
          storeSubject.type == STORE_SUBJECT_TYPES.PRODUCT) {
        invoice = C.pickone(invoices.filter(
          R.pathEq(['invoiceType', 'name'], '销项增值税')
        ));
      }
      let supplier;
      if (direction == STORE_ORDER_DIRECTIONS.INBOUND &&
          storeSubject.type == STORE_SUBJECT_TYPES.MATERIAL) {
        supplier = C.pickone(entities.filter(
          R.propEq('type', ENTITY_TYPES.SUPPLIER)
        ));
      }
      let customer;
      if (direction == STORE_ORDER_DIRECTIONS.OUTBOUND &&
          storeSubject.type == STORE_SUBJECT_TYPES.PRODUCT) {
        customer = C.pick(entities.filter(
          R.propEq('type', ENTITY_TYPES.CUSTOMER)
        ));
      }
      let date = C.date({ year: 2016, month: C.pickone([3, 4, 5, 6, 7, 8]) });
      let [{ id: account_term_id }] = accountTerms.filter(
        it => it.name == moment(date).format('YYYY-MM')
      );
      return {
        store_subject_id: storeSubject.id,
        quantity,
        unit_price,
        direction,
        date,
        account_term_id,
        department_id: C.pickone(departments).id,
        invoice_id: invoice && invoice.id,
        number: C.string({ pool: '1234567890' }),
        supplier_id: supplier && supplier.id,
        customer_id: customer && customer.id,
      };
    });
    yield knex.batchInsert('store_orders', rows);
    // adjust invoices' amount
    for (var invoice of invoices) {
      if (invoice.invoiceType === '普通发票') {
        continue;
      }
      let sos = yield knex('store_orders').where('invoice_id', invoice.id)
      .select('*');
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
