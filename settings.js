var Router = require('restify-router').Router;
var logger = require('./logger');
var loginRequired = require('./login-required');
var knex = require('./knex');
var casing = require('casing');

var router = new  Router();

var list = function (req, res, next) {
  knex('settings').select('*')
  .then(function (list) {
    res.json({ data: casing.camelize(list) });
    next();
  }, function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/list', loginRequired, list);

module.exports = {
  router,
};
