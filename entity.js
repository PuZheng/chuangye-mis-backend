var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');

var getObject = function (id) {
  return knex('entities').select('*').where('id', id)
  .then(function ([o]) {
    return casing.camelize(o);
  });
};


router.get(
  '/list', loginRequired, restify.queryParser(),
  function (req, res, next) {
    let q = knex('entities').select('*');
    if (req.params.type) {
      q = q.where('type', req.params.type);
    }
    q
    .then(function (list) {
      res.json({ data: casing.camelize(list) });
      next();
    })
    .catch(function (e) {
      next(e);
    });
  }
);

var hints = function hints(req, res, next) {
  let { kw, type } = req.params;
  let q = knex('entities');
  if (type) {
    q.where('type', type);
  }
  kw = kw.toUpperCase();
  q.whereRaw('UPPER(name) like ?', kw + '%')
  .orWhereRaw('UPPER(acronym) like ?', kw + '%')
  .select('*')
  .then(data => {
    res.json({ data: data.map(it => ({
      text: it.name,
      acronym: it.acronym,
    })) });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/hints/:kw', loginRequired, hints);

module.exports = {
  router,
  getObject
};
