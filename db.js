var config = require('./config.js');
var pgp = require('pg-promise')();
module.exports = {
  db: pgp(config.get('dbConnection'))
};
