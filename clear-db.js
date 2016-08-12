// drop tables
var config = require('./config.js');
var pgp = require('pg-promise')();
var logger = require('./logger.js');
var db = pgp(config.get('dbConnection'));

db.query(
    `
    DROP TABLE users;
    `
).then(function () {
  logger.info('\n\n----------------------------------------------');
  logger.info('CLEAR DB DONE!');
  logger.info('----------------------------------------------\n\n');
});

