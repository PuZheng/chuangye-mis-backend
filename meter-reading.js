var Router = require('restify-router').Router;
var restify = require('restify');
var knex = require('./knex');
var loginRequired = require('./login-required');
var casing = require('casing');
var R = require('ramda');
var { meter_readings: meterReadingDef } = require('./models');

var router = new Router();

var create = function create(req, res, next) {
  let data = R.pick(Object.keys(meterReadingDef), casing.snakeize(req.body));
  return knex('meter_readings').insert(data)
  .then(function () {
    res.json({});
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.post('/object', loginRequired, restify.bodyParser(), create);

module.exports = { router };
