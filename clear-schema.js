#! /usr/bin/env node
var models = require('./models');
var knex = require('./knex');
var logger = require('./logger');

var schema = knex.schema;
for (var tableName of Object.keys(models).reverse()) {
  schema.dropTableIfExists(tableName);
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
