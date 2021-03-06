var restify = require('restify');
var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var knex = require('./knex');
var casing = require('casing');

var router = new  Router();

var list = function (req, res, next) {
  knex('settings').select('*').orderBy('name')
  .then(function (list) {
    res.json({ data: casing.camelize(list) });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/list', loginRequired, list);

var edit = function (req, res, next) {
  knex('settings')
  .where('group', req.params.group)
  .where('name', req.params.name)
  .update(req.body)
  .then(function () {
    res.json({});
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.put('/:group/:name', loginRequired, restify.bodyParser(), edit);

module.exports = {
  router,
};
