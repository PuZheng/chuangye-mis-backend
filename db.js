var config = require('./config.js');
var pgp = require('pg-promise')();
module.exports = pgp(config.get('dbConnection'));
