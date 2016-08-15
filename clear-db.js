// drop tables
var config = require('./config.js');
var pgp = require('pg-promise')();
var logger = require('./logger.js');
var db = pgp(config.get('dbConnection'));

db.query(
    `
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS invoice_types;
    DROP TABLE IF EXISTS account_terms;
    DROP TABLE IF EXISTS entities;
    DROP TYPE IF EXISTS e_entity_type;
    DROP TYPE IF EXISTS e_material_type;
    `
).then(function () {
  logger.info('completed');
  pgp.end();
}).catch(function (e) {
  logger.error(e);
  pgp.end();
});

