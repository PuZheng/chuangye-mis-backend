var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var loginRequired = require('./login-required');
var logger = require('./logger');
var co = require('co');

var router = new Router();

var create = function (req, res, next) {
  let {accountTermId, def} = req.body;
  return co(function *() {
    let [{ count }] = yield knex('charge_bills')
    .where('account_term_id', accountTermId)
    .count();
    if (count > 0) {
      res.json(403, {
        reason: '一个帐期只能对应一个费用清单',
      });
    }
    yield knex('charge_bills').insert({
      account_term_id: accountTermId,
      def,
    })
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

router.post('/object/', loginRequired, restify.bodyParser(), create);

var list = function (req, res, next) {
  let q = knex('charge_bills');
  let { account_term_id } = req.params;
  if (account_term_id) {
    q.where('account_term_id', account_term_id);
  }
  q.select('*')
  .then(function (data) {
    res.json({ data, });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/list', loginRequired, restify.queryParser(), list);

var update = function (req, res, next) {
  let {def} = req.body;
  return knex('charge_bills').update({
    def,
  })
  .where('id', req.params.id)
  .then(function () {
    res.json({});
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), update);



module.exports = {
  router,
};
