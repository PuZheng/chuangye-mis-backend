var restify = require('restify');
var Router = require('restify-router').Router;
var logger = require('./logger');
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
      let department = (yield knex('departments').where('name', req.body.name).select('*'))[0];
      if (department) {
        res.json(400, {
          name: '已经存在该车间',
        });
      }
      let [id] = yield knex('departments').insert(
        R.pick(Object.keys(departmentDef), casing.camelize(req.body))
      )
      .returning('id');
      res.send({id});
      next();
    })
    .catch(function (e) {
      logger.error(e);
      next(e);
    });
  }
);

router.get('/list', loginRequired, function (req, res, next) {
  knex('departments').select('*')
  .then(function (list) {
    res.json({ data: casing.camelize(list) });
    next();
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

