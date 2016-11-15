#! /usr/bin/env node
var models = require('./models');
var knex = require('./knex');
var logger = require('./logger');

var schema = knex.schema;
for (var tableName of Object.keys(models).reverse()) {
  schema.raw(`drop table if exists ${tableName} cascade`);
}

schema
.then(function () {
  logger.info('clear schema completed');
  knex.destroy();
})
.catch(function (e) {
  logger.error(e);
  knex.destroy();
});
