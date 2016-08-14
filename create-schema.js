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
    CREATE TYPE e_entity_type AS ENUM (
      'supplier',
      'customer',
      'tenant',
      'owner',
      ''
    );
    CREATE TYPE e_material_type AS ENUM (
      'outbound',
      'inbound',
      ''
    );
    CREATE TABLE invoice_types (
      id serial PRIMARY KEY,
      name varchar (32) NOT NULL UNIQUE,
      vendor_type e_entity_type,
      purchaser_type e_entity_type,
      is_vat BOOLEAN,
      material_type e_material_type
    );
    CREATE TABLE account_terms (
      id serial PRIMARY KEY,
      name varchar (32) NOT NULL UNIQUE,
      created TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
    );
    `
).then(function () {
  logger.info('completed');
  pgp.end();
}, function (err) {
  logger.error(err.stack);
  pgp.end();
});
