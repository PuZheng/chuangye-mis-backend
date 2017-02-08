var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var router = new Router();
var loginRequired = require('./login-required');
var casing = require('casing');
var co = require('co');

router.get(
  '/list', loginRequired, restify.queryParser(),
  function (req, res, next) {
    let q = knex('<%= 表名称 %>');
    return co(function *() {
      let { page, page_size, sort_by } = req.params;
      for (let field of []) {
        req.params[field]  && q.where(field, req.params[field]);
      }
      let totalCnt = (yield q.clone().count('*'))[0].count;
      // sort by
      if  (sort_by) {
        let [col, order='asc'] = req.params.sort_by.split('.');
        q.orderBy(col, order);
      }
      // offset & limit
      if (page && page_size) {
        q.offset((req.params.page - 1) * page_size).limit(page_size);
      }
      let data = yield q.then(casing.camelize);
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
  }
);

router.put(
  '/object/:id', loginRequired, restify.bodyParser(),
  function (req, res, next) {

  }
);

router.get(
  '/object/:id', loginRequired,
  function (req, res, next) {

  }
);

module.exports = { router };
