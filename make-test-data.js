var config = require('./config.js');
var pgp = require('pg-promise')();
var db = pgp(config.get('dbConnection'));
var logger = require('./logger.js');
var roles = require('./roles');

var accounts = [
  ['kj1', 'kj1', roles.ACCOUNTANT],
  ['kj2', 'kj2', roles.ACCOUNTANT],
  ['cn1', 'cn1', roles.ACCOUNTANT],
  ['cn2', 'cn2', roles.ACCOUNTANT],
];

db.tx(function (t) {
  return t.batch(accounts.map(function (a) {
    return t.none(
      `
      INSERT INTO users (username, password, role) VALUES 
      ($1, crypt($2, gen_salt('md5')), $3)
      `,
      a
    );
  }));
}).then(function () {
  logger.info('completed');
  pgp.end();
}).catch(function (e) {
  logger.error(e);
  pgp.end();
});
