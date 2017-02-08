var restify = require('restify');
var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var knex = require('./knex');
var R = require('ramda');
var departmentDef = require('./models').departments;
var casing = require('casing');
var co = require('co');

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
      res.send({id});
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);

router.get('/list', loginRequired, function (req, res, next) {
  return co(function *() {
    let data = yield knex('departments').select('*').then(casing.camelize);
    for (let obj of data) {
      [obj.tenant] = yield knex('tenants').where({ department_id: obj.id })
      .select('*').then(casing.camelize);
    }
    res.json({ data });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
});

var getObject = function (id) {
  return knex('departments').where('id', id)
  .then(function ([obj]) {
    return casing.camelize(obj);
  });
};

module.exports = {
  router,
  getObject
};

