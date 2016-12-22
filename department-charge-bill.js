var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var casing = require('casing');
var loginRequired = require('./login-required');

var router = new Router();

var get = function get(req, res, next) {
  let { account_term_id, department_id } = req.params;
  return knex('department_charge_bills')
  .select('*')
  .where({ account_term_id, department_id })
  .then(casing.camelize)
  .then(function ([obj]) {
    if (!obj) {
      res.json(404, {});
    } else {
      res.json(obj);
    }
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/object', loginRequired, restify.queryParser(), get);

module.exports = { router };
