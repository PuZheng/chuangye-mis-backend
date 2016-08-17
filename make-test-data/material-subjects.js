#! /usr/bin/env node
var config = require('../config.js');
var pgp = require('pg-promise')();
var db = pgp(config.get('dbConnection'));
var logger = require('../logger.js');


var makeMaterialSubjects = function () {

  var materialSubjects = [
    { name: '原材料1', unit: 'kg', type: 'inbound' },
    { name: '原材料2', unit: '吨', type: 'inbound' },
    { name: '原材料3', unit: '桶', type: 'inbound' },
    { name: '产成品1', unit: '箱', type: 'outbound' },
    { name: '产成品2', unit: 'kg', type: 'outbound' },
    { name: '产成品3', unit: '吨', type: 'outbound' },
  ];
  return db.tx(function (t) {
    return t.batch(materialSubjects.map(function (it) {
      return t.none(
        `
        INSERT INTO material_subjects (name, unit, type) values
        ($<name>, $<unit>, $<type>)
        `,
        it
      );
    }));
  });
};

module.exports = makeMaterialSubjects;

if (require.main === module) {
  makeMaterialSubjects().then(function () {
    logger.info('completed');
    pgp.end();
  }, function (e) {
    logger.error(e);
    pgp.end();
  });
}
