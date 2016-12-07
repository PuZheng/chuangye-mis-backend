#!/usr/bin/env node
var knex = require('../knex');
var co = require('co');
var casing = require('casing');
var chance = require('chance');
var R = require('ramda');
var logger = require('../logger.js');

var C = new chance();

var makeMeterReadings = function makeMeterReadings() {
  return co(function *() {
    let meters = yield knex('meters').select('*').then(casing.camelize);
    let meterReadingTypes = yield knex('meter_reading_types').select('*')
    .then(casing.camelize);
    yield knex.batchInsert(
      'meter_readings',
      R.flatten(meters.map(function (meter) {
        return meterReadingTypes
        .filter(it => it.meterTypeId == meter.meterTypeId)
        .map(function (mrt) {
          return {
            value: C.floating({ min: 100, max: 200, fixed: 1 }),
            meter_id: meter.id,
            meter_reading_type_id: mrt.id,
          };
        });
      }))
    );
  });
};

if (require.main === module) {
  makeMeterReadings().then(function () {
    logger.info('meter readings completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
