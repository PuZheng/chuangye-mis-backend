var restify = require('restify');
var Router = require('restify-router').Router;
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');

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

module.exports = { router, getObject };
