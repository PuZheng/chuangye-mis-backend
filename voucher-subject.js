var Router = require('restify-router').Router;
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');

var router = new  Router();

var getObject = function getObject(id) {
  return knex('voucher_subjects')
  .select('*')
  .where('id', id)
  .then(function ([o]) {
    return casing.camelize(o);
  });
};

router.get('/list', loginRequired, function (req, res, next) {
  knex('voucher_subjects').select('*')
  .then(function (list) {
    res.json({ data: casing.camelize(list) });
    next();
  }, function (e) {
    logger.error(e);
    next(e);
  });
});

module.exports = { router, getObject };
