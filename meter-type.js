var Router = require('restify-router').Router;
var knex = require('./knex');
var loginRequired = require('./login-required');
var casing = require('casing');

var router = new Router();

var list = function (req, res, next) {
  knex('meter_types')    
  .select('*')
  .then(casing.camelize)
  .then(function (data) {
    res.json({
      data,
    });
    next();
  });
};

router.get('/list', loginRequired, list);

module.exports = { router };
