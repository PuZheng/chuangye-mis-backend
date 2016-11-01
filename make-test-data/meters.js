#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var meterStatus = require('../const').meterStatus;
var co = require('co');
var R = require('ramda');
var Chance = require('chance');
var C = new Chance();


var makeMeters = function *(trx, type) {
  let [{id: meter_type_id}] = yield trx('meter_types')
  .select('*')
  .where('name', type);
  // make total meters
  yield trx.batchInsert('meters', R.range(1, 9).map(function (n) {
    return {
      name: '总' + type + n,
      is_total: true,
      status: meterStatus.NORMAL,
      meter_type_id
    };
  }));
  let totalMeterIdList = (yield trx('meters')
                          .where({
                            is_total: true,
                            meter_type_id,
                          })
                          .select('id'))
                          .map(R.prop('id'));
  let departmentIdList = (yield trx('departments').select('id')).map(R.prop('id'));
  yield trx.batchInsert('meters', departmentIdList.map(function (department_id, idx) {
    return {
      name: '设备' + idx,
      is_total: false,
      department_id,
      times: 40,
      status: meterStatus.NORMAL,
      parent_meter_id: C.pickone(totalMeterIdList),
      meter_type_id
    };
  }));
};

if (require.main === module) {
  knex.transaction(function (trx) {
    return co(function *() {
      try {
        yield makeMeters(trx, '电表');
        yield makeMeters(trx, '水表');
        yield makeMeters(trx, '蒸汽表');
        logger.info('meters completed');
      } catch (e) {
        logger.error(e);
      } finally {
        knex.destroy();
      }
    });
  });
}
