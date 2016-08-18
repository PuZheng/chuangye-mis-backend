var models = require('./models');
var knex = require('./knex');
var logger = require('./logger');
var R = require('ramda');

var chainable = knex.schema;
for (var [tableName, def] of R.toPairs(models)) {
  chainable = chainable.createTableIfNotExists(tableName, function (def) {
    return function (table) {
      logger.info('create table: ' + table._tableName);
      for (var [fieldName, fieldDef] of R.toPairs(def)) {
        fieldDef(table);
      }
    };
  }(def));
}

chainable
.then(function () {
  logger.info('completed');
  knex.destroy();
})
.catch(function (e) {
  logger.error(e);
  knex.destroy();
});
