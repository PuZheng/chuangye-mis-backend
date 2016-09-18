var Router = require('restify-router').Router;
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');
var R = require('ramda');

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

var getHints = function (req, res, next) {
  knex('voucher_subjects')
  .where('name', 'like', req.params.kw + '%')
  .select('name')
  .then(function (list) {
    res.json({
      data: list.map(R.prop('name'))
    });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/hints/:kw', loginRequired, getHints);

module.exports = { router, getObject };
