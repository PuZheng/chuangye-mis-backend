var restify = require('restify');
var Router = require('restify-router').Router;
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');
var R = require('ramda');
var co = require('co');
var objDef = require('./models').voucher_subjects;

var router = new  Router();

var getObject = function getObject(id) {
  return knex('voucher_subjects')
  .select('*')
  .where('id', id)
  .then(function ([o]) {
    return casing.camelize(o);
  });
};

var fetchList = function (req, res, next) {
  let q = knex('voucher_subjects');
  let { kw, payer_type, recipient_type, only_public } = req.params;

  if (kw) {
    q.where('name', 'like', kw + '%').orWhereRaw('UPPER(acronym) like ?', kw.toUpperCase() + '%');
  }
  payer_type && q.where({ payer_type });
  recipient_type && q.where({ recipient_type });
  only_public == '1' && q.where({ is_public: true });

  q.select('*')
  .then(function (list) {
    res.json({ data: casing.camelize(list) });
    next();
  }, function (e) {
    logger.error(e);
    next(e);
  });
};
router.get('/list', loginRequired, restify.queryParser(), fetchList);

var getHints = function (req, res, next) {
  let { kw } = req.params;
  knex('voucher_subjects')
  .where('name', 'like', kw + '%')
  .orWhereRaw('UPPER(acronym) like ?', kw.toUpperCase() + '%')
  .select('name', 'acronym')
  .then(function (list) {
    res.json({
      data: list.map(function (obj) {
        return {
          text: obj.name,
          acronym: obj.acronym,
        };
      })
    });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/hints/:kw', loginRequired, getHints);

var create = function (req, res, next) {
  return co(function *() {
    let data = R.pick(Object.keys(objDef), casing.snakeize(req.body));
    let [{ count }] = yield knex('voucher_subjects')
    .where('name', data.name)
    .count();
    if (Number(count) > 0) {
      res.json(403, {
        fields: {
          name: '已经存在该名称',
        }
      });
      next();
      return;
    }
    let [id] = yield knex('voucher_subjects')
    .insert(data)
    .returning('id');
    res.json({
      id,
    });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.post('/object', loginRequired, restify.bodyParser(), create);

var get = function (req, res, next) {
  knex('voucher_subjects')
  .where('id', req.params.id)
  .then(function ([ obj ]) {
    res.json(casing.camelize(obj));
    next();
  });
};

router.get('/object/:id', loginRequired, get);

module.exports = { router, getObject };
