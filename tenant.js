var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var logger = require('./logger');
var loginRequired = require('./login-required');
var co = require('co');
var casing = require('casing');
var getEntity = require('./entity').getObject;
var getDepartment = require('./department').getObject;

var router = new Router();

var fullfill = function *(obj) {
  obj.entity = yield getEntity(obj.entityId);
  obj.department = yield getDepartment(obj.departmentId);
  return obj;
};

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

module.exports = { router };
