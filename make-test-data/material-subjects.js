#! /usr/bin/env node
var config = require('../config.js');
var pgp = require('pg-promise')();
var db = pgp(config.get('dbConnection'));
var logger = require('../logger.js');


var makeMaterialSubjects = function () {

  var materialSubjects = [
    { name: '原材料1', unit: 'kg' },
    { name: '原材料2', unit: '吨' },
    { name: '原材料3', unit: '桶' },
    { name: '产成品1', unit: '箱' },
    { name: '产成品2', unit: 'kg' },
    { name: '产成品3', unit: '吨' },
  ];
  return db.tx(function (t) {
    return t.batch(materialSubjects.map(function (it) {
      return t.none(
        `
        INSERT INTO material_subjects (name, unit) values
        ($<name>, $<unit>)
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
