const restify = require('restify');
const Router = require('restify-router').Router;
const loginRequired = require('./login-required');
const knex = require('./knex');
const R = require('ramda');
const {
  departments: departmentDef,
  tenants: tenantDef,
  plants: plantDef,
  entities: entityDef,
} = require('./models');
const casing = require('casing');
const co = require('co');
const layerify = require('./utils/layerify.js');


var router = new  Router();

router.post(
  '/object', loginRequired, restify.bodyParser(),
  function (req, res, next) {
    co(function *() {
      let [department] = yield knex('departments').where('name', req.body.name)
      .select('*');
      if (department) {
        res.json(400, {
          name: '已经存在该车间',
        });
      }
      let [id] = yield knex('departments').insert(
        R.pick(Object.keys(departmentDef), casing.snakeize(req.body))
      )
      .returning('id');
      res.json({id});
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);

router.get(
  '/list', loginRequired, restify.queryParser(),
  function (req, res, next) {
    return co(function *() {
      let { page, page_size, kw, plant_id } = req.params;
      let q = knex('departments')
      .join('plants', 'departments.plant_id', 'plants.id')
      .leftOuterJoin('tenants', 'tenants.department_id', 'departments.id')
      .leftOuterJoin('entities', 'tenants.entity_id', 'entities.id');

      plant_id && q.where('departments.plant_id', plant_id);

      if (kw) {
        kw = kw.toUpperCase();
        q
        .whereRaw('UPPER(departments.name) like ?', kw + '%')
        .orWhere(knex.raw('UPPER(departments.acronym) like ?', kw + '%'));
      }

      let totalCnt = (yield q.clone().count('*'))[0].count;

      q.offset((page - 1) * page_size).limit(page_size);

      let data = yield q.select([
        ...Object.keys(departmentDef).map(function (it) {
          return `departments.${it} as ${it}`;
        }),
        ...Object.keys(plantDef).map(function (it) {
          return `plants.${it} as plant__${it}`;
        }),
        ...Object.keys(tenantDef).map(function (it) {
          return `tenants.${it} as tenant__${it}`;
        }),
        ...Object.keys(entityDef).map(function (it) {
          return `entities.${it} as tenant__entity__${it}`;
        })
      ])
      .then(R.map(layerify))
      .then(casing.camelize);
      res.json({ data, totalCnt });
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);


var getObject = function (id) {
  return knex('departments').where('id', id)
  .then(function ([obj]) {
    return casing.camelize(obj);
  });
};

router.get('/object/:id', loginRequired, function (req, res, next) {
  let { id } = req.params;
  return knex('departments').where({ id })
  .then(function ([obj]) {
    res.json(obj);
    next();
  });
});

router.put(
  '/object/:id', loginRequired, restify.bodyParser(),
  function (req, res, next) {
    let { id }  = req.params;
    let { name, acronym, plant_id } = req.body;
    knex.transaction(function (trx) {
      return co(function *() {
        let [{ count }] = yield trx('departments').where({ name })
        .andWhereNot({ id }).count();
        if (Number(count) > 0) {
          res.json(400, {
            name: '已经存在'
          });
          next();
          return;
        }
        yield trx('departments').update({ name, acronym, plant_id })
        .where({ id });
        res.json({ id });
        next();
      })
      .catch(function (err) {
        res.log.error({ err });
        next(err);
      });
    });
  }
);

router.get('/hints/:kw', function (req, res, next) {
  let q = knex('departments');
  let { kw } = req.params;
  kw = kw.toUpperCase();
  q.whereRaw('UPPER(name) like ?', kw + '%')
  .orWhere(knex.raw('UPPER(acronym) like ?', kw + '%'))
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

module.exports = {
  router,
  getObject
};

