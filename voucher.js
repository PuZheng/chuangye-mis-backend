var Router = require('restify-router').Router;
var knex = require('./knex');
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var restify = require('restify');

var router = new  Router();

var getObject = function getObject(id) {
  
};

var newObject = function newObject(req, res, next) {

};

router.post('/object', loginRequired, restify.bodyParser(), newObject);

router.get('/object/:id', loginRequired, function (req, res, next) {
  getObject(req.params.id).then(function (o) {
    res.json(o);
    next();
  }).catch(function (e) {
    logger.error(e);
    next(e);
  });
});

module.exports = { router, getObject };


