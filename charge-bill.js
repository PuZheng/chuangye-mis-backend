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

router.post('/object/', loginRequired,
            restify.bodyParser(), create);

module.exports = {
  router,
};
