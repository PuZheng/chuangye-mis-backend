#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var meterStatus = require('../const').meterStatus;
var co = require('co');


var makeAmmeters = function () {
  return co(function *() {
    let [{id: electricMeterTypeId}] = yield knex('meter_types')
    .select('*')
    .where('name', '电表');
    let [{id: waterMeterTypeId}] = yield knex('meter_types')
    .select('*')
    .where('name', '水表');
    let [{id: steamMeterTypeId}] = yield knex('meter_types')
    .select('*')
    .where('name', '蒸汽表');
    let [id] = yield knex('meters').insert({
      name: '分配箱1',
      is_total: true,
      status: meterStatus.NORMAL,
      meter_type_id: electricMeterTypeId
    }).returning('id');
    yield knex('meters').insert({
      name: '1',
      is_total: false,
      department_id: (yield knex('departments').select('*'))[0].id,
      times: 40,
      status: meterStatus.NORMAL,
      parent_meter_id: id,
      meter_type_id: electricMeterTypeId
    });
    id = (yield knex('meters').insert({
      name: '线路1',
      is_total: true,
      status: meterStatus.NORMAL,
      meter_type_id: waterMeterTypeId,
    }).returning('id'))[0];
    yield knex('meters').insert({
      name: '1',
      is_total: false,
      department_id: (yield knex('departments').select('*'))[0].id,
      times: 40,
      status: meterStatus.NORMAL,
      parent_meter_id: id,
      meter_type_id: waterMeterTypeId,
    });

    id = (yield knex('meters').insert({
      name: '总表1',
      is_total: true,
      status: meterStatus.NORMAL,
      meter_type_id: steamMeterTypeId,
    }).returning('id'))[0];
    yield knex('meters').insert({
      name: '1',
      is_total: false,
      department_id: (yield knex('departments').select('*'))[0].id,
      times: 40,
      status: meterStatus.NORMAL,
      parent_meter_id: id,
      meter_type_id: steamMeterTypeId,
    });
  });
};


module.exports = makeAmmeters;

if (require.main === module) {
  makeAmmeters()
  .then(function () {
    logger.info('completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
