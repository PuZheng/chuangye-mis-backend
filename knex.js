var conf = require('./config.js');

module.exports = require('knex')(conf.get('knexOpts'));
