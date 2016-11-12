var Router = require('restify-router').Router;
var router = new  Router();
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

var list = function (req, res, next) {
  let q = knex('store_subjects').select('*');
  let { kw } = req.params;
  if (kw) {
    kw = kw.toUpperCase();
    q.whereRaw('UPPER(name) like ?',  kw + '%')
    .orWhere(knex.raw('UPPER(acronym) like ?', kw + '%'));
  }
  q.then(function (list) {
    res.json({ data: casing.camelize(list) });
    next();
  }).catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/list', loginRequired, restify.queryParser(), list);

var hints = function (req, res, next) {
  let kw = req.params.kw.toUpperCase();
  knex('store_subjects')
  .whereRaw('UPPER(name) like ?',  kw + '%')
  .orWhere(knex.raw('UPPER(acronym) like ?', kw + '%'))
  .then(function (list) {
    res.json({ data: list.map(it => it.name) });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};


router.get('/hints/:kw', loginRequired, hints);


module.exports = {
  getObject,
  router,
};
