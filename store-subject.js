var Router = require('restify-router').Router;
var router = new  Router();
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');
var restify = require('restify');
var co = require('co');
var R = require('ramda');
var storeSubjectDef = require('./models').store_subjects;

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

router.get('/object/:id', loginRequired, function (req, res, next) {
  return getObject(req.params.id)
  .then(function (obj) {
    res.json(obj);
    next();
  });
});

var create = function (req, res, next) {
  return knex.transaction(function (trx) {
    return co(function *() {
      let { name } = req.body;
      let [{ count }] = yield trx('store_subjects')
      .where('name', name)
      .count();
      if (Number(count) > 0) {
        res.json(400, {
          fields: {
            name: '该名称已经存在',
          }
        });
        next();
        return;
      }
      let obj = R.pick(Object.keys(storeSubjectDef),
                       casing.snakeize(req.body));
      yield trx('store_subjects').insert(obj).returning('id')
      .then(function ([id]) {
        res.json({ id });
        next();
      })
      .catch(function (err) {
        res.log.error({ err });
        next(err);
      });
    });
  });
};

router.post('/object', loginRequired, restify.bodyParser(), create);

var update = function (req, res, next) {
  return knex.transaction(function (trx) {
    let { id } = req.params;
    let { name, unit, acronym } = req.body;
    return co(function *() {
      let [{ count }] = yield trx('store_subjects').whereNot({ id })
      .andWhere({ name })
      .count();
      if (Number(count) > 0) {
        res.json(400, {
          fields: {
            name: '该名称已经存在',
          }
        });
        next();
        return;
      }
      yield trx('store_subjects').update({ name, unit, acronym })
      .where({ id })
      .then(function () {
        res.json({ id });
        next();
      })
      .catch(function (err) {
        res.log.error({ err });
        next(err);
      });
    });
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), update);

module.exports = {
  getObject,
  router,
};
