BEGIN;
    CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        username varchar (32) NOT NULL UNIQUE,
        password varchar (64) NOT NULL,
        role varchar (16) NOT NULL,
        created TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
    );
    CREATE TYPE e_entity_type AS ENUM (
        'supplier',
        'customer',
        'tenant',
        'owner',
        ''
    );
    CREATE TYPE e_material_type AS ENUM (
        'outbound',
        'inbound',
        ''
    );
    CREATE TABLE IF NOT EXISTS invoice_types (
        id serial PRIMARY KEY,
        name varchar (32) NOT NULL UNIQUE,
        vendor_type e_entity_type,
        purchaser_type e_entity_type,
        is_vat BOOLEAN,
        material_type e_material_type
    );
    CREATE TABLE IF NOT EXISTS account_terms (
        id serial PRIMARY KEY,
        name varchar (32) NOT NULL UNIQUE,
        created TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
    );
    CREATE TABLE IF NOT EXISTS entities (
        id serial PRIMARY KEY,
        name varchar (32) NOT NULL UNIQUE,
        type e_entity_type NOT NULL,
        acronym varchar (32),
        created TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
    );
    CREATE TABLE IF NOT EXISTS material_subjects (
        id serial PRIMARY KEY,
        name varchar(32) NOT NULL UNIQUE,
        unit varchar(16) NOT NULL,
        type e_material_type NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invoices (
        id serial PRIMARY KEY,
        invoice_type_id integer REFERENCES invoice_types NOT NULL,
        date date NOT NULL,
        number varchar(64) NOT NULL,
        account_term_id integer REFERENCES account_terms NOT NULL,
        is_vat BOOLEAN,
        vendor_id integer REFERENCES entities,
        purchaser_id integer REFERENCES entities,
        notes varchar(128)
    );
    CREATE TABLE IF NOT EXISTS material_notes (
        id serial PRIMARY KEY,
        material_subject_id integer REFERENCES material_subjects,
        quantity NUMERIC,
        unit_price NUMERIC(2),
        tax_rate NUMERIC,
        invoice_id integer REFERENCES invoices
    );
    CREATE TABLE IF NOT EXISTS voucher_types (
        id serial PRIMARY KEY,
        name varchar(32) NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS voucher_subjects (
        id serial PRIMARY KEY,
        name varchar(32) NOT NULL UNIQUE,
        acronym varchar (32),
        payer_type e_entity_type, 
        recipient_type e_entity_type,
        notes varchar(128),
        is_public boolean
    );
    CREATE TABLE IF NOT EXISTS vouchers (
        id serial PRIMARY KEY,
        number varchar(64) NOT NULL,
        voucher_type_id integer REFERENCES voucher_types,
        date date NOT NULL,
        voucher_subject_id integer REFERENCES voucher_subjects,
        is_public boolean,
        payer_id integer REFERENCES entities,
        recipient_id integer REFERENCES entities,
        notes varchar(128)
    );
END;
