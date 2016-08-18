var knex = require('./knex');
var casing = require('casing');

var getObject = function (id) {
  return knex('users').select('*').where('id', id)
  .then(function ([o]) {
    delete o.password;
    return casing.camelize(o);
  });
};

module.exports = { getObject };

