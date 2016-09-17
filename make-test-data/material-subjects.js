#! /usr/bin/env node
var knex = require('../knex');
var logger = require('../logger');
var materialTypes = require('../const').materialTypes;


var makeMaterialSubjects = function () {
  var rows = [
    { name: '原材料1', unit: 'kg', type: materialTypes.INBOUND },
    { name: '原材料2', unit: '吨', type: materialTypes.INBOUND },
    { name: '原材料3', unit: '桶', type: materialTypes.INBOUND },
    { name: '产成品1', unit: '箱', type: materialTypes.OUTBOUND },
    { name: '产成品2', unit: 'kg', type: materialTypes.OUTBOUND },
    { name: '产成品3', unit: '吨', type: materialTypes.OUTBOUND },
  ];
  return knex.batchInsert('material_subjects', rows);
};

module.exports = makeMaterialSubjects;

if (require.main === module) {
  makeMaterialSubjects().then(function () {
    logger.info('completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}
