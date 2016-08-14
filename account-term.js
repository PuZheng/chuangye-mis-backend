var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var db = require('./db.js');
var loginRequired = require('./login-required');
var casing = require('casing');

router.get(
  '/list', loginRequired, 
  function (req, res, next) {
    db.query(
      `
        select * from account_terms;
      `
    ).then(function (list) {
      res.json({ data: casing.camelize(list) });
      next();
    }).catch(function (e) {
      next(e);
    });
  });

module.exports = router;
