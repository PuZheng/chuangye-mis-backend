var restify = require('restify');
var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var knex = require('./knex');
var casing = require('casing');

var router = new Router();

router.get('/object', loginRequired, restify.queryParser(), function (req, res, next) {
  let { account_term_id } = req.params;
  knex('operating_reports')
  .where({ account_term_id })
  .select('*')
  .then(casing.camelize)
  .then(function ([operatingReport]) {
    if (!operatingReport) {
      res.send(404, {});
      next();
      return;
    }
    res.json(operatingReport);
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
});

module.exports = {
  router
};
