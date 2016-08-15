var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var db = require('./db');
var loginRequired = require('./login-required');
var casing = require('casing');

router.get(
  '/list', loginRequired, restify.queryParser(),
  function (req, res, next) {
    let q = 'select * from entities ';
    let params = [];
    if (req.params.type) {
      q += 'where type=$1';
      params.push(req.params.type);
    }
    db.query(q, params).then(function (list) {
      res.json({ data: casing.camelize(list) });
      next(); 
    }).catch(function (e) {
      next(e);
    });
  }
);

module.exports = router;
