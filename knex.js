var conf = require('./config.js');

module.exports = require('knex')({
  client: 'pg',
  connection: conf.get('dbConnection'),
});
