var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var db = require('./db.js');
var casing = require('casing');
var loginRequired = require('./login-required');

router.get(
  '/list', loginRequired, 
  function invoiceTypelistCb(req, res, next) {
    db.query(
      `
        select * from invoice_types;
      `
    ).then(function (list) {
      res.json({ data: casing.camelize(list) });
      next();
    }).catch(function (e) {
      next(e);
    });
  });

module.exports = router;


