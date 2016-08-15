#! /usr/bin/env node
var config = require('../config.js');
var pgp = require('pg-promise')();
var db = pgp(config.get('dbConnection'));
var logger = require('../logger.js');

var makeEntities = function () {

  var entities = [
    { name: '承包人1', acronym: 'cbr1', type: 'tenant' },
    { name: '承包人2', acronym: 'cbr2', type: 'tenant' },
    { name: '承包人3', acronym: 'cbr3', type: 'tenant' },
    { name: '承包人4', acronym: 'cbr3', type: 'tenant' },
    { name: '业主', acronym: 'yz', type: 'owner' },
    { name: '客户1', acronym: 'kh1', type: 'customer' },
    { name: '客户2', acronym: 'kh2', type: 'customer' },
    { name: '客户3', acronym: 'kh3', type: 'customer' },
    { name: '供应商1', acronym: 'gys1', type: 'supplier' },
    { name: '供应商2', acronym: 'gys2', type: 'supplier' },
  ];

  return db.tx(function (t) {
    return t.batch(entities.map(function (it) {
      return db.none(
        `
        INSERT INTO entities (name, type, acronym) values
        ($<name>, $<type>, $<acronym>)
        `,
        it
      );
    }));
  });
};

module.exports = makeEntities;

if (require.main === module) {
  makeEntities().then(function () {
    logger.info('completed');
    pgp.end();
  }, function (e) {
    logger.error(e);
    pgp.end();
  });
}
