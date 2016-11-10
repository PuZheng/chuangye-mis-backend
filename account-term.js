var restify = require('restify');
var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');
var R = require('ramda');
var objDef = require('./models').account_terms;

var router = new Router();

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
    return knex('account_terms')
    .select('*')
    .orderBy('name', 'desc')
    .then(function (list) {
      res.json({ data: casing.camelize(list) });
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);

router.post(
  '/object', loginRequired, restify.bodyParser(),
  function (req, res, next) {
    knex('account_terms')
    .insert(R.pick(Object.keys(objDef), req.body))
    .returning('id')
    .then(function ([id]) {
      res.json({id});
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);

module.exports = {
  router,
  getObject,
};
