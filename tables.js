exports.voucher = {
  id: 'serial PRIMARY KEY',
  number: 'varchar(64) NOT NULL',
  voucher_type_id: 'integer REFERENCES voucher_types',
  date: 'date NOT NULL',
  voucher_subject_id: 'integer REFERENCES voucher_subjects',
  is_public: 'boolean',
  payer_id: 'integer REFERENCES entities',
  recipient_id: 'integer REFERENCES entities',
  notes: 'varchar(128)',
};
