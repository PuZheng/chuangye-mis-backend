#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var Chance = require('chance');
var C = new Chance();
var R = require('ramda');
var { storeOrderTypes, storeOrderDirections } = require('../const');

var makeStoreOrders = function () {
  return knex('store_subjects')
  .select('*')
  .then(function (storeSubjects) {
    let rows = R.range(0, 500).map(function () {
      return [
        C.pickone(storeSubjects).id,
        C.integer({ min: 1, max: 1000 }),
        C.integer({ min: 1, max: 1000 }),
        C.pickone(R.values(storeOrderDirections)),
        C.pickone(R.values(storeOrderTypes)),
        C.date({ year: 2016, month: C.pickone([5, 6, 7, 8]) }),
      ];
    });
    return knex.batchInsert('store_orders', rows.map(function ([
      store_subject_id, 
      quantity,
      unit_price,
      direction,
      type,
      created,
    ]) {
      return {
        store_subject_id, 
        quantity,
        unit_price,
        direction,
        type,
        created,
      };
    }));
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
