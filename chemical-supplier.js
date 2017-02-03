var restify = require('restify');
var { Router } = require('restify-router');
var knex = require('./knex');
var router = new Router();
var co = require('co');
var layerify = require('./utils/layerify');
var R = require('ramda');
var casing = require('casing');
var {
  chemical_suppliers: chemicalSuppilerModel,
  entities: entityModel
} = require('./models');
var {
  ENTITY_TYPES: { CHEMICAL_SUPPLIER }
} = require('./const');

router.get('/list', restify.queryParser(), function (req, res, next) {
  let q = knex('chemical_suppliers')
  .join('entities', 'chemical_suppliers.entity_id', '=', 'entities.id');
  let { kw, page, page_size } = req.params;

  return co(function *() {
    if (kw) {
      kw = kw.toUpperCase();
      q
      .whereRaw('UPPER(entities.name) like ?', kw + '%')
      .orWhere(knex.raw('UPPER(entities.acronym) like ?', kw + '%'));
    }
    let totalCnt = (yield q.clone().count('*'))[0].count;

    if (page && page_size) {
      q.offset((page - 1) * page_size).limit(page_size);
    }
    let data = yield q.select(
      ...Object.keys(chemicalSuppilerModel).map(it => `chemical_suppliers.${it} as ${it}`),
      ...Object.keys(entityModel).map(it => `entities.${it} as entity__${it}`)
    )
    .then(R.map(layerify))
    .then(casing.camelize);
    res.json({
      totalCnt,
      data
    });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
});

router.get('/hints/:kw', function (req, res, next) {
  let q = knex('entities').where({ type: CHEMICAL_SUPPLIER });
  let { kw } = req.params;
  kw = kw.toUpperCase();
  q.andWhere(function () {
    this.whereRaw('UPPER(name) like ?', kw + '%')
    .orWhere(knex.raw('UPPER(acronym) like ?', kw + '%'));
  })
  .then(function (list) {
    res.json({
      data: list.map(function (it) {
        return {
          text: it.name,
          acronym: it.acronym
        };
      })
    });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
});

module.exports = { router };
