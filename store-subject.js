var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');
var restify = require('restify');

var getObject = function (id) {
  return knex('store_subjects').select('*')
  .where('id', id)
  .then(function ([o]) {
    return casing.camelize(o);
  });
};

router.get('/list', loginRequired, restify.queryParser(), function (req, res, next) {
  let q = knex('store_subjects').select('*');
  q
  .then(function (list) {
    res.json({ data: casing.camelize(list) });
    next();
  }).catch(function (e) {
    logger.error(e);
    next(e);
  });
});

module.exports = {
  getObject,
  router,
};