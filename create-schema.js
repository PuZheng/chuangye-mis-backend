// create tables

var config = require('./config.js');
var pgp = require('pg-promise')();
var logger = require('./logger.js');

var db = pgp(config.get('dbConnection'));
db.query(
    `
    CREATE TABLE users (
      id serial PRIMARY KEY,
      username varchar (32) NOT NULL UNIQUE,
      password varchar (64) NOT NULL,
      role varchar (16) NOT NULL,
      created TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
    );
    `
).then(function () {
  logger.info('\n\n----------------------------------------------');
  logger.info('MAKE TEST DATA DONE!');
  logger.info('----------------------------------------------\n\n');
}, function (err) {
  logger.error(err);
});
