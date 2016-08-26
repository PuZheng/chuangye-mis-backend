#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var settingGroups = require('../const').settingGroups;

var makeSettings = function () {
  var rows = [
    // power
    { name: '尖峰电价', value: '1.123', group: settingGroups.POWER},
    { name: '低谷电价', value: '0.457', group: settingGroups.POWER},
    { name: '高峰电价', value: '0.941', group: settingGroups.POWER},
    { name: '基本电费', value: '30', group: settingGroups.POWER},
    { name: '线损率', value: '6', group: settingGroups.POWER},
    { name: '变压器容量', value: '5200', group: settingGroups.POWER},
  ];
  return knex.batchInsert('settings', rows);
};

module.exports = makeSettings;

if (require.main === module) {
  makeSettings()
  .then(function () {
    logger.info('completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
