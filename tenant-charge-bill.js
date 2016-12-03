var Router = require('restify-router').Router;
var restify = require('restify');
var loginRequired = require('./login-required');
var knex = require('./knex');
var casing = require('casing');

var router = new Router();

var get = function get(req, res, next) {
  let { tenant_id, account_term_id } = req.params;
  return knex('tenant_charge_bills')
  .where({ tenant_id, account_term_id })
  .select('*')
  .then(function ([obj]) {
    if (!obj) {
      res.json(404, {});
    } else {
      res.json(casing.camelize(obj));
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
