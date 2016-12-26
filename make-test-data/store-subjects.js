#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var { STORE_SUBJECT_TYPES } = require('../const');


var makeStoreSubjects = function () {
  var rows = [
    [ '原材料1', 'kg', 'ycl1', STORE_SUBJECT_TYPES.MATERIAL ],
    [ '原材料2', '吨', 'ycl2', STORE_SUBJECT_TYPES.MATERIAL ],
    [ '原材料3', '桶', 'ycl3', STORE_SUBJECT_TYPES.MATERIAL ],
    [ '产成品1', '箱', 'ccp1', STORE_SUBJECT_TYPES.PRODUCT ],
    [ '产成品2', 'kg', 'ccp2', STORE_SUBJECT_TYPES.PRODUCT ],
    [ '产成品3', '吨', 'ccp3', STORE_SUBJECT_TYPES.PRODUCT ],
  ].map(function ([name, unit, acronym, type]) {
    return { name, unit, acronym, type };
  });
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
