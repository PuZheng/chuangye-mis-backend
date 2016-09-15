#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var meterStatus = require('../const').meterStatus;
var meterTypes = require('../const').meterTypes;
var co = require('co');


var makeAmmeters = function () {
  return co(function *() {
    let id = (yield knex('meters').insert({
      name: '分配箱1',
      is_total: true,
      status: meterStatus.NORMAL,
      type: meterTypes.ELECTRIC,
    }).returning('id'))[0];
    yield knex('meters').insert({
      name: '1',
      is_total: false,
      department_id: (yield knex('departments').select('*'))[0].id,
      times: 40,
      status: meterStatus.NORMAL,
      parent_meter_id: id,
      type: meterTypes.ELECTRIC
    });
    id = (yield knex('meters').insert({
      name: '线路1',
      is_total: true,
      status: meterStatus.NORMAL,
      type: meterTypes.WATER,
    }).returning('id'))[0];
    yield knex('meters').insert({
      name: '1',
      is_total: false,
      department_id: (yield knex('departments').select('*'))[0].id,
      times: 40,
      status: meterStatus.NORMAL,
      parent_meter_id: id,
      type: meterTypes.WATER,
    });

    id = (yield knex('meters').insert({
      name: '总表1',
      is_total: true,
      status: meterStatus.NORMAL,
      type: meterTypes.STEAM,
    }).returning('id'))[0];
    yield knex('meters').insert({
      name: '1',
      is_total: false,
      department_id: (yield knex('departments').select('*'))[0].id,
      times: 40,
      status: meterStatus.NORMAL,
      parent_meter_id: id,
      type: meterTypes.STEAM,
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
