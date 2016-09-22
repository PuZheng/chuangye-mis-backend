var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var logger = require('./logger');
var permissionRequired = require('./permission-required');
var loginRequired = require('./login-required');
var casing = require('casing');
var R = require('ramda');
var objDef = require('./models').users;
var co = require('co');
var config = require('./config.js');
var admin = config.get('admin');

var router = new  Router();

var getObject = function (id) {
  return knex('users').select('*').where('id', id)
  .then(function ([o]) {
    delete o.password;
    return casing.camelize(o);
  });
};

router.get('/object/:id', loginRequired, permissionRequired('edit.user'), function(req, res, next) {
  return getObject(req.params.id)
  .then(function (obj) {
    res.json(obj);
    next();
  });
});

var listCb = function (req, res, next) {
  knex('users')
  .select('*')
  .orderBy('username')
  .then(function (list) {
    res.json({
      data: list.map(R.compose(casing.camelize, R.omit('password'))),
    });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/list', loginRequired, permissionRequired('edit.user'), listCb);

var updateCb = function (req, res, next) {
  let { id } = req.params;
  let data = R.pick(Object.keys(objDef), casing.snakeize(req.body));
  return co(function *() {
    if (data.name) {
      let [{ count }] = yield knex('users')
      .where('name', 'data.name')
      .whereNot('id', id)
      .count();
      if (Number(count) > 0) {
        res.json(400, {
          fields: {
            name: '该名称已经存在',
          }
        });
        next();
        return;
      }
    }
    if (!data.enabled && data.username == admin.username) {
      res.json(400, {
        fields: {
          enabled: '不能锁定超级管理员',
        }
      });
      next();
      return;
    }
    if (data.password) {
      data.password = knex.raw('crypt(?, gen_salt(\'md5\'))', [data.password]);
    }
    yield knex('users')
    .where('id', id)
    .update(data);
    res.json({});
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.put('/object/:id', loginRequired, permissionRequired('edit.user'), restify.bodyParser(), updateCb);

var create = function (req, res, next) {
  let data = R.pick(Object.keys(objDef), casing.snakeize(req.body));
  return co(function *() {
    let [{ count }] = yield knex('users') 
    .where('username', data.username)
    .count();
    if (Number(count) > 0) {
        res.json(400, {
          fields: {
            name: '已经存在该名称',
          }
        });
        return;
    }
    if (data.password) {
      data.password = knex.raw('crypt(?, gen_salt(\'md5\'))', [data.password]);
    }
    knex('users')
    .insert(data)
    .returning('id')
    .then(function ([id]) {
      res.json({ id });
      next();
    });
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  }); 
};

router.post('/object', loginRequired, permissionRequired('edit.user'), restify.bodyParser(), create);

module.exports = { getObject, router };
