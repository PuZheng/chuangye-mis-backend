var Router = require('restify-router').Router;
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');

var router = new  Router();

var getObject = function (id) {
  return knex('account_terms')
  .select('*')
  .where('id', id)
  .then(function ([o]) {
    return casing.camelize(o);
  });
};

router.get(
  '/list', loginRequired, 
  function (req, res, next) {
    knex('account_terms').select('*').then(function (list) {
      res.json({ data: casing.camelize(list) });
      next();
    }).catch(function (e) {
      next(e);
    });
  }
);

module.exports = {
  router,
  getObject,
};
