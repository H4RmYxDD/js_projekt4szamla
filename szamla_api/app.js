import express from 'express';
import sqlite3 from 'sqlite3';

const app = express();
const db = new sqlite3.Database('./db/invoices.db');

app.use(express.json());

app.get('/customers', (req, res) => {
  db.all('SELECT * FROM customers', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/customers/:id/invoices', (req, res) => {
  db.all(
    `SELECT invoices.*,
            issuer.name AS issuer_name,
            issuer.address AS issuer_address,
            issuer.tax_number AS issuer_tax_number
     FROM invoices
     JOIN customers AS issuer ON invoices.issuer_id = issuer.id
     WHERE invoices.customer_id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get('/invoices', (req, res) => {
  db.all('SELECT * FROM invoices', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/invoices', (req, res) => {
  const {
    issuer_id,
    customer_id,
    invoice_number,
    issue_date,
    fulfillment_date,
    payment_deadline,
    total_amount,
    vat_amount
  } = req.body;

  db.run(
    `INSERT INTO invoices (issuer_id, customer_id, invoice_number, issue_date, fulfillment_date, payment_deadline, total_amount, vat_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      issuer_id,
      customer_id,
      invoice_number,
      issue_date,
      fulfillment_date,
      payment_deadline,
      total_amount,
      vat_amount
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});
app.get('/issuers', (req, res) => {
  db.all('SELECT * FROM customers', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
app.get('/issuers/:id/invoices', (req, res) => {
  db.all(
    `SELECT invoices.*,
            issuer.name AS issuer_name,
            issuer.address AS issuer_address,
            issuer.tax_number AS issuer_tax_number,
            customer.name AS customer_name
     FROM invoices
     JOIN customers AS issuer ON invoices.issuer_id = issuer.id
     JOIN customers AS customer ON invoices.customer_id = customer.id
     WHERE invoices.issuer_id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});
app.post('/customers', (req, res) => {
  const { name, address, tax_number } = req.body;
  db.get('SELECT id FROM free_customer_ids ORDER BY id LIMIT 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      // Van szabad ID, azt használjuk
      const reusedId = row.id;
      db.run('DELETE FROM free_customer_ids WHERE id = ?', [reusedId], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        db.run(
          'INSERT INTO customers (id, name, address, tax_number) VALUES (?, ?, ?, ?)',
          [reusedId, name, address, tax_number],
          function(err3) {
            if (err3) return res.status(500).json({ error: err3.message });
            res.json({ id: reusedId });
          }
        );
      });
    } else {
      // Nincs szabad ID, keresd a legnagyobb ID-t
      db.get('SELECT MAX(id) AS maxId FROM customers', [], (err4, row2) => {
        if (err4) return res.status(500).json({ error: err4.message });
        const newId = row2.maxId ? row2.maxId + 1 : 1;
        db.run(
          'INSERT INTO customers (id, name, address, tax_number) VALUES (?, ?, ?, ?)',
          [newId, name, address, tax_number],
          function(err5) {
            if (err5) return res.status(500).json({ error: err5.message });
            res.json({ id: newId });
          }
        );
      });
    }
  });
});
app.put('/customers/:id', (req, res) => {
  const { name, address, tax_number } = req.body;
  db.run(
    `UPDATE customers SET name = ?, address = ?, tax_number = ? WHERE id = ?`,
    [name, address, tax_number, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

app.delete('/customers/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.run(
    `DELETE FROM customers WHERE id = ?`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.run(
        `INSERT INTO free_customer_ids (id) VALUES (?)`,
        [id],
        function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ deleted: this.changes });
        }
      );
    }
  );
});

app.listen(3000, () => {
  console.log('API fut a http://localhost:3000 címen');
});
app.use(express.static('frontend'));