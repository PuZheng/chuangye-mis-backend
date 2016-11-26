#!/usr/bin/env node
var logger = require('../logger');
var knex = require('../knex');
var entityTypes = require('../const').entityTypes;
var co = require('co');
var chance = require('chance');

var C = new chance();

if (require.main === module) {
  co(function *() {
    try {
      let entities = yield knex('entities').where('type', entityTypes.CUSTOMER)
      .orWhere('type', entityTypes.SUPPLIER);
      let rows = entities.map(function (it) {
        return {
          entity_id: it.id,
          tax_number: C.string({ length: 12, pool: '1234567890' }),
          address: C.address(),
          bank: C.string({ length: 10, pool: 'abcdefghijklmn' }),
          account: C.string({ length: 12, pool: '1234567890' }),
          contact: C.phone(),
        };
      });
      yield knex.batchInsert('partners', rows);
      logger.info('partners compeleted');
    } catch (e) {
      logger.error(e);
    } finally {
      knex.destroy();
    }
  });
}
