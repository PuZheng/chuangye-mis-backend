const restify = require('restify');
const Router = require('restify-router').Router;
const knex = require('./knex');
const router = new Router();
const loginRequired = require('./login-required');
const casing = require('casing');
const co = require('co');
const R = require('ramda');
const layerify = require('./utils/layerify.js');
const {
  departments: departmentDef,
  tenants: tenantDef
} = require('./models.js');

router.get(
  '/list', loginRequired, restify.queryParser(),
  function (req, res, next) {
    let q = knex('plants');
    return co(function *() {
      let totalCnt = (yield q.clone().count('*'))[0].count;
      // sort by
      let {page, page_size} = req.params;
      if (page && page_size) {
        q.offset((req.params.page - 1) * page_size).limit(page_size);
      }
      let data = yield q.then(casing.camelize);
      for (let it of data) {
        let departments = yield knex('departments')
        .leftOuterJoin('tenants', 'tenants.department_id', 'departments.id')
        .where({ 'departments.plant_id': it.id })
        .select([
          ...Object.keys(departmentDef).map(function (it) {
            return `departments.${it} as ${it}`;
          }),
          ...Object.keys(tenantDef).map(function (it) {
            return `tenants.${it} as tenant__${it}`;
          })
        ])
        .then(R.map(layerify))
        .then(casing.camelize);
        it.departmentCnt = departments.length;
        it.leasedDepartmentCnt = departments.filter(R.prop('tenant')).length;
      }
      res.json({ totalCnt, data });
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
    knex.transaction(function (trx) {
      return co(function *() {
        let data = casing.snakeize(req.body);
        let [{count}] = yield trx('plants').where({ name: data.name }).count('*');
        if (Number(count) > 0) {
          res.json(400, {
            name: '该名称已经存在',
          });
          next();
          return;
        }
        let [id] = yield trx.insert(data).into('plants')
        .returning('id');
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

router.put(
  '/object/:id', loginRequired, restify.bodyParser(),
  function (req, res, next) {
    knex.transaction(function (trx) {
      return co(function *() {
        let { id } = req.params;
        let { name, area } = req.body;
        let [{ count }] = yield trx('plants').where({ name })
        .andWhereNot({ id }).count();
        if (Number(count) > 0) {
          res.json(400, {
            name: '已经存在',
          });
          next();
          return;
        }
        yield trx('plants').update({ name, area }).where({ id });
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

router.get(
  '/object/:id', loginRequired,
  function (req, res, next) {
    let { id } = req.params;
    knex('plants').where({ id })
    .then(casing.camelize)
    .then(function ([obj]) {
      res.json(obj);
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });

  }
);

module.exports = { router };
