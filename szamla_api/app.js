import express from 'express';
import sqlite3 from 'sqlite3';

const app = express();
const db = new sqlite3.Database('./db/invoices.db');

app.use(express.json());

app.get('/issuers', (req, res) => {
  db.all('SELECT * FROM customers', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/customers', (req, res) => {
  db.all('SELECT * FROM customers', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/customers', (req, res) => {
  const { name, address, tax_number } = req.body;
  db.get('SELECT id FROM free_customer_ids ORDER BY id LIMIT 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
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

app.get('/invoices', (req, res) => {
  db.all('SELECT * FROM invoices', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/customers/:id/invoices', (req, res) => {
  db.all(
    `SELECT * FROM invoices WHERE customer_id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get('/issuers/:id/invoices', (req, res) => {
  db.all(
    `SELECT * FROM invoices WHERE issuer_id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
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

  const issue = new Date(issue_date);
  const deadline = new Date(payment_deadline);
  if ((deadline - issue) / (1000 * 60 * 60 * 24) > 30) {
    return res.status(400).json({ error: 'A fizetési határidő nem lehet több, mint 30 nap a kiállítás dátumától.' });
  }

  db.get('SELECT * FROM customers WHERE id = ?', [issuer_id], (err, issuer) => {
    if (err || !issuer) return res.status(400).json({ error: 'Hibás kiállító ID' });
    db.get('SELECT * FROM customers WHERE id = ?', [customer_id], (err2, customer) => {
      if (err2 || !customer) return res.status(400).json({ error: 'Hibás vevő ID' });

      db.run(
        `INSERT INTO invoices (
          issuer_id, customer_id, invoice_number, issue_date, fulfillment_date, payment_deadline,
          total_amount, vat_amount,
          issuer_name, issuer_address, issuer_tax_number,
          customer_name, customer_address, customer_tax_number,
          is_storno
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          issuer_id,
          customer_id,
          invoice_number,
          issue_date,
          fulfillment_date,
          payment_deadline,
          total_amount,
          vat_amount,
          issuer.name,
          issuer.address,
          issuer.tax_number,
          customer.name,
          customer.address,
          customer.tax_number
        ],
        function (err3) {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ id: this.lastID });
        }
      );
    });
  });
});

app.post('/api/invoices/:id/storno', (req, res) => {
  const originalId = req.params.id;
  db.get(`SELECT * FROM invoices WHERE id = ?`, [originalId], (err, invoice) => {
    if (err || !invoice) return res.status(404).json({ error: 'Számla nem található' });

    db.run(`UPDATE invoices SET is_storno = 1 WHERE id = ?`, [originalId], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });

      const stornoInvoiceNumber = invoice.invoice_number + '-ST';
      db.run(
        `INSERT INTO invoices (
          issuer_id, customer_id, invoice_number, issue_date, fulfillment_date, payment_deadline,
          total_amount, vat_amount,
          issuer_name, issuer_address, issuer_tax_number,
          customer_name, customer_address, customer_tax_number,
          is_storno
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          invoice.issuer_id,
          invoice.customer_id,
          stornoInvoiceNumber,
          invoice.issue_date,
          invoice.fulfillment_date,
          invoice.payment_deadline,
          invoice.total_amount,
          invoice.vat_amount,
          invoice.issuer_name,
          invoice.issuer_address,
          invoice.issuer_tax_number,
          invoice.customer_name,
          invoice.customer_address,
          invoice.customer_tax_number
        ],
        function (err3) {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ message: 'Stornószámla kiállítva', new_invoice_id: this.lastID });
        }
      );
    });
  });
});

app.post('/invoices/:invoiceId/items', (req, res) => {
  const { name, quantity, unit, unit_price, net_amount, vat_amount, gross_amount } = req.body;
  db.run(
    `INSERT INTO invoice_items (invoice_id, name, quantity, unit, unit_price, net_amount, vat_amount, gross_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.invoiceId, name, quantity, unit, unit_price, net_amount, vat_amount, gross_amount],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.get('/invoices/:invoiceId/items', (req, res) => {
  db.all(
    `SELECT * FROM invoice_items WHERE invoice_id = ?`,
    [req.params.invoiceId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.put('/invoices/:invoiceId/items/:itemId', (req, res) => {
  const { name, quantity, unit, unit_price, net_amount, vat_amount, gross_amount } = req.body;
  db.run(
    `UPDATE invoice_items SET name = ?, quantity = ?, unit = ?, unit_price = ?, net_amount = ?, vat_amount = ?, gross_amount = ?
     WHERE id = ? AND invoice_id = ?`,
    [name, quantity, unit, unit_price, net_amount, vat_amount, gross_amount, req.params.itemId, req.params.invoiceId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

app.delete('/invoices/:invoiceId/items/:itemId', (req, res) => {
  db.run(
    `DELETE FROM invoice_items WHERE id = ? AND invoice_id = ?`,
    [req.params.itemId, req.params.invoiceId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    }
  );
});
app.get('/invoices/:id', (req, res) => {
  db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Számla nem található' });
    res.json(row);
  });
});

app.use(express.static('frontend'));

app.listen(3000, () => {
  console.log('API fut a http://localhost:3000 címen');
});