// drop tables
var config = require('./config.js');
var pgp = require('pg-promise')();
var logger = require('./logger.js');
var db = pgp(config.get('dbConnection'));

db.query(
    `
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS invoice_types;
    DROP TYPE IF EXISTS e_entity_type;
    DROP TYPE IF EXISTS e_material_type;
    DROP TABLE IF EXISTS account_terms;
    `
).then(function () {
  logger.info('\n\n----------------------------------------------');
  logger.info('CLEAR DB DONE!');
  logger.info('----------------------------------------------\n\n');
  pgp.end();
}).catch(function (e) {
  logger.error(e);
  pgp.end();
});

