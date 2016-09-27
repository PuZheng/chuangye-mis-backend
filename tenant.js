var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var logger = require('./logger');
var loginRequired = require('./login-required');
var co = require('co');
var casing = require('casing');
var getEntity = require('./entity').getObject;
var getDepartment = require('./department').getObject;
var entityTypes = require('./const').entityTypes;
var R = require('ramda');

var router = new Router();

var fullfill = function (obj) {
  return getEntity(obj.entityId)
  .then(function (entity) {
    obj.entity = entity;
  })
  .then(function () {
    return getDepartment(obj.departmentId);
  })
  .then(function (department) {
    obj.department = department;
    return obj;
  });
};

router.get('/object/:id', loginRequired, function (req, res, next) {
  knex('tenants')
  .select('*')
  .where('id', req.params.id)
  .then(function ([tenant]) {
    return fullfill(casing.camelize(tenant));
  })
  .then(function (tenant) {
    res.json(tenant);
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
});

router.get('/hints/:kw', loginRequired, function(req, res, next) {
  let kw = req.params.kw;
  knex('tenants')
  .join('entities', 'tenants.entity_id', '=', 'entities.id')
  .where('entities.name', 'like', kw + '%')
  .orWhere(knex.raw('UPPER(entities.acronym) like ?', kw.toUpperCase() + '%'))
  .select('entities.name', 'entities.acronym')
  .then(function (list) {
      res.json({ 
        data: list.map(function (i) {
          return {
            text: i.name,
            acronym: i.acronym
          };
        })
      });
      next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
});

var fetchList = function (req, res, next) {
  co(function *() {
    let q = knex('tenants');
    let kw = req.params.kw;

    if (kw) {
      q
      .join('entities', 'tenants.entity_id', '=', 'entities.id')
      .where('entities.name', 'like', kw + '%')
      .orWhere(knex.raw('UPPER(entities.acronym) like ?', kw.toUpperCase() + '%'));
    }

    let totalCnt = (yield q.clone().count('*'))[0].count;

    let {page, page_size} = req.params;
    if (page && page_size) {
      q.offset((req.params.page - 1) * page_size).limit(page_size);
    }
    let data = yield q.select('tenants.*');
    for (var i = 0; i < data.length; ++i) {
      data[i] = yield fullfill(casing.camelize(data[i]));
    }
    res.json({
      totalCnt,
      data,
    });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/list', loginRequired, restify.queryParser(), fetchList);

var newObject = function (req, res, next) {
  knex.transaction(function (trx) {
    let {
      entity: {
        name,
        acronym,
      },
      departmentId,
      contact,
    } = req.body;
    return co(function *() {
      let entity = (yield knex('entities')
                    .where('name', name)
                   .select('*'))[0];
      if (entity) {
        res.json(400, {
          fields: {
            name: '已经存在该名称',
          }
        });
        return;
      }
      let [entity_id] = yield trx.insert({
        name,
        acronym,
        type: entityTypes.TENANT,
      })
      .into('entities')
      .returning('id');
      let [id] = yield trx
      .insert({
        entity_id,
        department_id: departmentId,
        contact: contact, 
      })
      .into('tenants')
      .returning('id');
      res.json({ id });
      next();
    });
  })
  .catch(function (e) {
      logger.error(e);
      next(e);
  }); 
};

router.post('/object', loginRequired, restify.bodyParser(), newObject);

var updateObject = function (req, res, next) {
  co(function *() {
    let { id } = req.params;
    let [tenant] = yield knex('tenants') 
    .where('id', id)
    .select('*');
    if (!tenant) {
      res.json(400, {
        message: '不存在该承包人',
      });
      next();
      return;
    };

    let {
      entity: {
        name,
        acronym,
      } = {},
      contact,
      departmentId
    } = req.body;
    if (name) {
      let [{ count }] = yield knex('tenants')
      .join('entities', 'tenants.entity_id', '=', 'entities.id')
      .where('entities.name', name)
      .whereNot('tenants.id', id)
      .count();
      if (Number(count) > 0) {
        res.json(400, {
          fields: {
            name: '已经存在该名称',
          }
        });
        next();
        return;
      }
    }
    yield knex.transaction(function (trx) {
      return co(function *(){
        if (name || acronym)  {
          let data = {};
          if (name != undefined) {
            data.name = name;
          }
          if (acronym != undefined) {
            data.acronym = acronym;
          }
          if (!R.isEmpty(data)) {
            yield trx('entities')
            .update(data)
            .where('id', tenant.entity_id);
          }
        }
        let data = {};
        if (contact) {
          data.contact = contact;
        }
        if (departmentId) {
          data.department_id = departmentId;
        }
        if (!R.isEmpty(data)) {
          yield trx('tenants')
          .update(data)
          .where('id', req.params.id);
        }
      });
    });
  })
  .then(function () {
    res.json({});
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), updateObject);

module.exports = { router };
