var Router = require('restify-router').Router;
var knex = require('./knex');
var loginRequired = require('./login-required');
var logger = require('./logger');

var router = new Router();

var getHints = function getHints(req, res, next) {
  let kw = req.params.kw;
  knex('ammeters')
  .where('name', 'like', kw + '%')
  .select('name')
  .then(function (list) {
    res.json({
      data: list.map(function ({ name }) {
        return {
          text: name
        };
      })
    });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/hints/:kw', loginRequired, getHints);

module.exports = { router };
