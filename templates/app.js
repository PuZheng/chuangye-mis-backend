var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var router = new Router();
var loginRequired = require('./login-required');
var casing = require('casing');

router.get(
  '/list', restify.queryParser(),
  function (req, res, next) {
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
