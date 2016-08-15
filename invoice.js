var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var db = require('./db');
var loginRequired = require('./login-required');
var casing = require('casing');

router.post(
  '/object', loginRequired, 
  function (res, req, next) {

  }
);
