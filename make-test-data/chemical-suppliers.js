#!/usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');
var co = require('co');
var { argv } = require('yargs');
var Chance = require('chance');
var R = require('ramda');
var pinyin = require('pinyin');

var chance = new Chance();
var {
  ENTITY_TYPES: {
    CHEMICAL_SUPPLIER
  }
} = require('../const');

var makeName = function () {
  let familyNames = '褚卫蒋沈韩杨朱秦尤许';
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

var makeChemicalSuppliers = function makeChemicalSuppliers() {
  return co(function *() {
    let entities = R.range(0, Number(argv.n || 1000)).map(
      function () {
        let name = makeName();
        let acronym =  pinyin(name, {
          style: pinyin.STYLE_FIRST_LETTER
        }).map(it => it[0]).join('');
        return {
          name,
          acronym,
          type: CHEMICAL_SUPPLIER
        };
      }
    );
    let entityIds = yield knex.batchInsert('entities', entities).returning('id');
    yield knex.batchInsert('chemical_suppliers', entityIds.map(function (entity_id) {
      return {
        entity_id,
        contact: '1' + chance.string({ pool: '1234567890', length: '10' }),
      };
    }));
  });
};

if (require.main === module) {
  logger.info('creating chemical suppliers...');
  makeChemicalSuppliers()
  .then(function () {
    logger.info('DONE');
    knex.destroy();
  }, function (e) {
    logger.error(e);
    knex.destroy();
  });
}

