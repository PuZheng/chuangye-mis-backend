// create minimum data 
var config = require('./config.js');
var pgp = require('pg-promise')();
var logger = require('./logger.js');
var db = pgp(config.get('dbConnection'));

var admin = config.get('admin');

db.query(
    `
    INSERT INTO users (username, password, role) VALUES
    ($1, crypt($2, gen_salt('md5')), $3);
    `, 
    [admin.username, admin.password, 'admin']
).then(function () {
  logger.info('completed');
  pgp.end();
}, function (e) {
  logger.error(e);
  pgp.end();
});
