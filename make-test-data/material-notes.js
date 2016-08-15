#! /usr/bin/env node
var config = require('../config.js');
var pgp = require('pg-promise')();
var db = pgp(config.get('dbConnection'));
var logger = require('../logger.js');
var Chance = require('chance');
var R = require('ramda');
var casing = require('casing');

var makeMaterialNotes = function () {
  let chance = new Chance();
  return Promise.all([
    db.query('select * from invoices'),
    db.query('select * from material_subjects'),
  ]).then(function ([invoices, materialSubjects]) {
    invoices = casing.camelize(invoices);
    materialSubjects = casing.camelize(materialSubjects);
    var materialNotes = R.range(0, 128).map(function () {
      return {
        material_subject_id: chance.pickone(materialSubjects).id,
        quantity: chance.floating({ min: 1, fixed: 2, max: 100 }),
        unit_price: chance.floating({ min: 10, max: 100 }),
        tax_rate: chance.floating({ min: 10, max: 20, fixed: 1 }),
        invoice_id: chance.pickone(invoices).id
      };
    });
    let q = 'INSERT INTO material_notes(material_subject_id, quantity, unit_price, tax_rate, invoice_id) VALUES ';
    q += materialNotes.map(function (it) {
      return `(${it.material_subject_id}, ${it.quantity}, ${it.unit_price}, ${it.tax_rate}, ${it.invoice_id})`;
    }).join(', ');
    q += ';';
    return db.none(q);
  });
};

module.exports = makeMaterialNotes;

if (require.main === module) {
  makeMaterialNotes().then(function () {
    logger.info('completed');
    pgp.end();
  }).then(function (e) {
    logger.error(e.stack);
    pgp.end;
  });
}
