var restify = require('restify');
var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');
var R = require('ramda');
var objDef = require('./models').account_terms;
var co = require('co');
var { invoiceActions } = require('./const');
var { sm } = require('./invoice');

var router = new Router();

var getObject = function (id) {
  return knex('account_terms')
  .select('*')
  .where('id', id)
  .then(function ([o]) {
    return casing.camelize(o);
  });
};

router.get(
  '/list', loginRequired,
  function (req, res, next) {
    return knex('account_terms')
    .select('*')
    .orderBy('name', 'desc')
    .then(function (list) {
      res.json({ data: casing.camelize(list) });
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
    knex('account_terms')
    .insert(R.pick(Object.keys(objDef), req.body))
    .returning('id')
    .then(function ([id]) {
      res.json({id});
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);

router.post(
  '/object/:id/:action', loginRequired,
  function (req, res, next) {
    let { id, action } = req.params;
    action = action.toUpperCase();
    knex.transaction(function (trx) {
      return co(function *() {
        if (action === 'CLOSE') {
          let invoices = yield trx('invoices').where({ account_term_id: id })
          .select('*');
          for (let invoice of invoices) {
            if (~sm.state(invoice.status).actions
                .indexOf(invoiceActions.AUTHENTICATE)) {
              yield sm.perform(invoiceActions.AUTHENTICATE, invoice.id);
            }
          }
          yield trx('account_terms').update({ closed: true })
          .where({ id });
        }
        res.json({});
        next();
      })
      .catch(function (err) {
        res.log.error({ err });
        next(err);
      });
    });
  }
);

module.exports = {
  router,
  getObject,
};
