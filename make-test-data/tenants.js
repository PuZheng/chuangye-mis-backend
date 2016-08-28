#! /usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');
var co = require('co');
var pinyin = require('pinyin');
var Chance = require('chance');
var R = require('ramda');
var entityTypes = require('../const').entityTypes;

var chance = new Chance();

var makeName = function () {
  let familyNames = '赵钱孙李周吴郑王冯陈';
  let givenNames = '一二三四五六七八九十百千万甲乙丙丁';
  var i = 0, j = 0, k = 0;
  return function() {
    let name = familyNames[i] + givenNames[j] + givenNames[k++];
    if (k == givenNames.length) {
      k = 0;
      ++j;
    }
    if (j == givenNames.length) {
      j = 0;
      i = (i + 1) % familyNames.length;
    }
    return name;
  };
}();

var makeTenants = function () {
  return co(function *() {
    let departments = yield knex('departments').select('*');
    var rows = R.range(0, departments.length).map(
      function () {
        let name = makeName();
        let acronym = pinyin(name, {
          style: pinyin.STYLE_NORMAL
        }).map(i => i[0][0]).join('');
        return {
          name,
          acronym,
          type: entityTypes.TENANT,
        };
      }
    );
    let entitieIds = yield knex.batchInsert('entities', rows).returning('id');
    yield knex.batchInsert('tenants', R.zipWith(function (department, entitiyId) {
      return {
        department_id: department.id,
        entity_id: entitiyId,
        contact: '1' + chance.string({ pool: '1234567890', length: '10' }),
      };
    }, departments, entitieIds));
  });
};

module.exports = makeTenants;

if (require.main === module) {
  makeTenants().then(function () {
    logger.info('completed');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}