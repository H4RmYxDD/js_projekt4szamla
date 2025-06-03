import sqlite3 from 'sqlite3';
sqlite3.verbose();

const db = new sqlite3.Database('./db/invoices.db');

db.serialize(() => {
  db.run("DROP TABLE IF EXISTS invoices");
  db.run("DROP TABLE IF EXISTS customers");

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
      FOREIGN KEY (issuer_id) REFERENCES customers(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

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

  db.all("SELECT id FROM customers", (err, rows) => {
    if (err) throw err;

    const insertInvoice = db.prepare(`
      INSERT INTO invoices (issuer_id, customer_id, invoice_number, issue_date, fulfillment_date, payment_deadline, total_amount, vat_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let invoiceNum = 1000;
    rows.forEach((row, i) => {
      for (let j = 1; j <= 3; j++) {
        const today = new Date();
        const issueDate = today.toISOString().slice(0, 10);
        const fulfillmentDate = issueDate;
        const paymentDeadline = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const total = 10000 + i * 1000 + j * 500;
        const vat = total * 0.27;
        const issuerIndex = (i + j) % rows.length;
        const issuerId = rows[issuerIndex].id;
        insertInvoice.run(
          issuerId,
          row.id,
          `INV-${invoiceNum++}`,
          issueDate,
          fulfillmentDate,
          paymentDeadline,
          total,
          vat
        );
      }
    });

    insertInvoice.finalize(() => {
      console.log('Adatbázis feltöltve.');
      db.close();
    });
  });
});