var Router = require('restify-router').Router;
var restify = require('restify');
var knex = require('./knex');
var loginRequired = require('./login-required');
var casing = require('casing');

var router = new Router();

var get = function get(req, res, next) {
  let { entity_id, account_term_id } = req.params;
  return knex('account_books').where({
    entity_id, account_term_id,
  })
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
