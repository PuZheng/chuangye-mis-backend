#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var Chance = require('chance');
var C = new Chance();
var R = require('ramda');
var { storeOrderTypes, storeOrderDirections } = require('../const');
var co = require('co');

var makeStoreOrders = function () {
  return co(function *() {
    let storeSubjects = yield knex('store_subjects').select('*');
    let tenants = yield knex('tenants').select('*');
    let rows = R.range(0, 500).map(function () {
      let direction = C.pickone(R.values(storeOrderDirections));
      let type = C.pickone(R.values(storeOrderTypes));
      let tax_rate;
      let quantity = C.integer({ min: 1, max: 1000 });
      let unit_price;
      if ((direction == storeOrderDirections.INBOUND && type == storeOrderTypes.MATERIAL) ||
         (direction === storeOrderDirections.OUTBOUND && type == storeOrderTypes.PRODUCT)) {
        tax_rate = 17;
        unit_price = C.integer({ min: 1, max: 1000 });
      }
      return {
        store_subject_id: C.pickone(storeSubjects).id,
        quantity,
        unit_price,
        direction, 
        type, 
        created: C.date({ year: 2016, month: C.pickone([5, 6, 7, 8]) }),
        tenant_id: C.pickone(tenants).id,
        tax_rate,
      };
    });
    yield knex.batchInsert('store_orders', rows);
  });
};

module.exports = makeStoreOrders;

if (require.main === module) {
  makeStoreOrders()
  .then(function () {
    logger.info('completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
