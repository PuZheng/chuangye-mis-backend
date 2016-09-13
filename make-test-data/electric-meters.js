#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var electricMeterStatus = require('../const').electricMeterStatus;
var co = require('co');


var makeAmmeters = function () {
  return co(function *() {
    let id = (yield knex('electric_meters').insert({
      name: '分配箱1',
      is_total: true,
      status: electricMeterStatus.NORMAL,
    }).returning('id'))[0];
    console.log(id);
    yield knex('electric_meters').insert({
      name: '1',
      is_total: false,
      department_id: (yield knex('departments').select('*'))[0].id,
      times: 40,
      status: electricMeterStatus.NORMAL,
      parent_electric_meter_id: id,
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
