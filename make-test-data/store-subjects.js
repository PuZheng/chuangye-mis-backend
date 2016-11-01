#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');


var makeStoreSubjects = function () {
  var rows = [
    { name: '原材料1', unit: 'kg', acronym: 'ycl1' },
    { name: '原材料2', unit: '吨', acronym: 'ycl2' },
    { name: '原材料3', unit: '桶', acronym: 'ycl3' },
    { name: '产成品1', unit: '箱', acronym: 'ccp1' },
    { name: '产成品2', unit: 'kg', acronym: 'ccp2' },
    { name: '产成品3', unit: '吨', acronym: 'ccp3' },
  ];
  return knex.batchInsert('store_subjects', rows);
};

module.exports = makeStoreSubjects;

if (require.main === module) {
  makeStoreSubjects().then(function () {
    logger.info('store subjects completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
