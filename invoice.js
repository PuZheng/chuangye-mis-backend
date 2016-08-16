var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var db = require('./db');
var loginRequired = require('./login-required');
var casing = require('casing');
var co = require('co');
var cofy = require('cofy');
var knex = require('./knex');

router.post(
  '/object', loginRequired, restify.bodyParser(),
  function (req, res, next) {
    let trx;
    co(function *() {
      let trx = yield cofy.fn(knex.transaction, false, knex)();
      let invoice = {
        invoiceTypeId: req.body.invoiceTypeId,
        date: req.body.date,
        number: req.body.number,
        accountTermId: req.body.accountTermId,
        isVat: req.body.isVat,
        vendorId: req.body.vendorId,
        purchaserId: req.body.purchaserId,
        notes: req.body.notes
      };
      let materialNotes = invoice.materialNotes;
      let [id] = yield trx
      .insert(casing.snakeize(invoice))
      .returning('id')
      .into('invoices');
      for (var mn of (materialNotes || [])) {
        mn = {
          material_subject_id: mn.materialSubjectId,
          quantity: mn.quantity,
          unit_price: mn.unitPrice,
          tax_rate: mn.taxRate,
          invoice_id: id,
        };
        yield trx.insert(mn).into('material_notes');
      }
      yield trx.commit();
      res.send({id});
      next();
    })
    .catch(function (e) {
      logger.error(e.stack);
      trx.rollback().then(function () {
        next(e);
      });
    });
  });

module.exports = router;
