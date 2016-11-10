#! /usr/bin/env node
var models = require('./models');
var knex = require('./knex');
var logger = require('./logger');
var R = require('ramda');

var schema = knex.schema;
for (var [tableName, def] of R.toPairs(models)) {
  schema = schema.createTableIfNotExists(tableName, function (def) {
    return function (table) {
      logger.info('create table: ' + table._tableName);
      for (let [, fieldDef] of R.toPairs(def)) {
        fieldDef(table);
      }
    };
  }(def));
}

schema
.then(function () {
  logger.info('completed');
  knex.destroy();
})
.catch(function (e) {
  logger.error(e);
  knex.destroy();
});
