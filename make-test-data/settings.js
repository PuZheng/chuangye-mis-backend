#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var settingGroups = require('../const').settingGroups;

var makeSettings = function () {
  var rows = [
    // power
    { name: '尖峰电价', value: '1.123', comment: '元/度', group: settingGroups.电费},
    { name: '低谷电价', value: '0.457', comment: '元/度', group: settingGroups.电费},
    { name: '高峰电价', value: '0.941', comment: '元/度', group: settingGroups.电费},
    { name: '基本电费', value: '30', comment: '元/KV', group: settingGroups.电费},
    { name: '线损率', value: '6', comment: '百分比', group: settingGroups.电费},
    { name: '变压器容量', value: '5200', comment: 'KV', group: settingGroups.电费},
    // water
    { name: '工业水价', value: '3.3', comment: '元/吨', group: settingGroups.水费 },
    { name: '生活水价', value: '6.92', comment: '元/吨', group: settingGroups.水费 },
    { name: '污水治理费', value: '41.0', comment: '元/吨', group: settingGroups.水费 },
    { name: '治理税可地税部分', value: '41.0', comment: '元/吨',
      group: settingGroups.水费 },
    { name: '污泥费', value: '0.71', comment: '元/吨', group: settingGroups.水费 },
    // 蒸汽费用
    { name: '蒸汽价', value: '261.8', comment: '元/吨',  group: settingGroups.蒸汽费 },
    { name: '线损蒸汽价', value: '226.8', comment: '元/吨', group: settingGroups.蒸汽费 },
    { name: '蒸汽线损', value: '7', comment: '元/吨', group: settingGroups.蒸汽费 },
    // 氰化钠
    { name: '氰化钠分摊', value: '680', comment: '元/吨', group: settingGroups.氰化钠分摊 },
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
