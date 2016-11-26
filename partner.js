var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var loginRequired = require('./login-required');
var knex = require('./knex');
var layerify = require('./utils/layerify');
var { partners: partnerDef, entities: entityDef } = require('./models');
var R = require('ramda');
var casing = require('casing');
var co = require('co');

var list = function list(req, res, next) {
  co(function *() {
    let q = knex('partners')
    .join('entities', 'entities.id', '=', 'partners.entity_id');
    let { kw, type } = req.params;
    if (kw) {
      kw = kw.toUpperCase();
      q.whereRaw('UPPER(name) like ?', kw + '%')
      .orWhereRaw('UPPER(acronym) like ?', kw + '%');
    }
    type && q.where('entities.type', type);
    let [{ count: totalCnt }] = yield q.clone().count('*');
    // order by
    let { sort_by } = req.params;
    if (sort_by) {
      let [col, order] = sort_by.split('.');
      order = order || 'asc';
      q.orderBy(col, order);
    } else {
      q.orderBy('id');
    }

    // offset & limit
    let {page, page_size} = req.params;
    if (page && page_size) {
      q.offset((req.params.page - 1) * page_size).limit(page_size);
    }
    return q.select([
      ...Object.keys(partnerDef).map(it => 'partners.' + it),
      ...Object.keys(entityDef).map(it =>
                                    'entities.' + it + ' as entity__' + it)
    ])
    .then(R.map(layerify))
    .then(R.map(casing.camelize))
    .then(function (data) {
      res.json({ totalCnt, data });
      next();
    });
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/list', loginRequired, restify.queryParser(), list);

var create = function create(req, res, next) {
  return knex.transaction(function (trx) {
    return co(function *() {
      let obj = casing.snakeize(req.body);
      let [{ count }] = yield trx('entities').where('name', obj.entity.name)
      .count('*');
      if (Number(count) > 0) {
        res.json(400, {
          'entity.name': '该名称已经存在'
        });
        return;
      }
      let [ entityId ] = yield trx('entities').insert(obj.entity)
      .returning('id');
      obj = R.pick(Object.keys(partnerDef), obj);
      obj.entity_id = entityId;
      [obj] = yield trx('partners').insert(obj).returning('*');
      res.json(obj);
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  });
};

router.post('/object', loginRequired, restify.bodyParser(), create);

var update = function update(req, res, next) {
  return knex.transaction(function (trx) {
    return co(function *() {
      let obj = req.body;
      let [{ count }] = yield trx('entities').where('name', obj.entity.name)
      .andWhereNot('id', obj.entityId)
      .count('*');
      if (Number(count) > 0) {
        res.json(400, {
          'entity.name': '该名称已经存在'
        });
        return;
      }
      let { id } = req.params;
      obj = casing.snakeize(obj);
      yield trx('entities').update(obj.entity).where('id', obj.entity_id);
      yield trx('partners').update(R.pick(Object.keys(partnerDef), obj))
      .where('id', req.params.id);
      res.json({ id });
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), update);

var get = function get(req, res, next) {
  let { id } = req.params;
  knex('partners').where('partners.id', id)
  .join('entities', 'entities.id', '=', 'partners.entity_id')
  .select([
    ...Object.keys(partnerDef).map(it => 'partners.' + it),
    ...Object.keys(entityDef).map(it => 'entities.' + it + ' as entity__' + it),
  ])
  .then(it => casing.camelize(layerify(it[0])))
  .then(function (obj) {
    res.json(obj);
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/object/:id', loginRequired, get);

module.exports = {
  router,
};
