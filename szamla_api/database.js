import sqlite3 from 'sqlite3';
sqlite3.verbose();

const db = new sqlite3.Database('./db/invoices.db');

db.serialize(() => {
  db.run("DROP TABLE IF EXISTS invoice_items");
  db.run("DROP TABLE IF EXISTS invoices");
  db.run("DROP TABLE IF EXISTS customers");
  db.run("DROP TABLE IF EXISTS free_customer_ids");

  db.run(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      tax_number TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS free_customer_ids (
      id INTEGER PRIMARY KEY
    )
  `);

  db.run(`
    CREATE TABLE invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issuer_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      fulfillment_date TEXT NOT NULL,
      payment_deadline TEXT NOT NULL,
      total_amount REAL NOT NULL,
      vat_amount REAL NOT NULL,
      issuer_name TEXT NOT NULL,
      issuer_address TEXT NOT NULL,
      issuer_tax_number TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      customer_tax_number TEXT NOT NULL,
      is_storno INTEGER DEFAULT 0,
      FOREIGN KEY (issuer_id) REFERENCES customers(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  db.run(`
    CREATE TABLE invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      net_amount REAL NOT NULL,
      vat_amount REAL NOT NULL,
      gross_amount REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    )
  `);

  // Példa adatok (opcionális)
  const customers = [
    { name: 'Kiss Kft.', address: '1111 Budapest, Fő utca 1.', tax_number: '12345678-1-11' },
    { name: 'Nagy Bt.', address: '2222 Debrecen, Kossuth tér 2.', tax_number: '87654321-2-22' },
    { name: 'Szabó Zrt.', address: '3333 Szeged, Petőfi utca 3.', tax_number: '11223344-3-33' }
  ];

  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, address, tax_number) VALUES (?, ?, ?)
  `);

  customers.forEach(c => insertCustomer.run(c.name, c.address, c.tax_number));
  insertCustomer.finalize();

  db.close();
});