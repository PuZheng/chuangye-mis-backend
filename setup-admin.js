#! /usr/bin/env node

var config = require('./config.js');
var pgp = require('pg-promise')();
var logger = require('./logger.js');
var db = pgp(config.get('dbConnection'));
var roles = require('./roles');

var admin = config.get('admin');

db.query(
    `
    INSERT INTO users (username, password, role) VALUES
    ($1, crypt($2, gen_salt('md5')), $3);
    `, 
    [admin.username, admin.password, roles.ADMIN]
).then(function () {
  logger.info('completed');
  pgp.end();
}, function (e) {
  logger.error(e);
  pgp.end();
});
