let items = [];
let lastInvoiceId = null;

document.getElementById('customerForm').onsubmit = function(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(this).entries());
  fetch('/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(() => {
    this.reset();
    loadCustomers();
  });
};

document.getElementById('itemForm').onsubmit = function(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(this).entries());
  data.quantity = parseFloat(data.quantity);
  data.unit_price = parseFloat(data.unit_price);
  data.net_amount = parseFloat(data.net_amount);
  data.vat_amount = parseFloat(data.vat_amount);
  data.gross_amount = parseFloat(data.gross_amount);
  items.push(data);
  renderItems();
  this.reset();
};

function renderItems() {
  const tbody = document.querySelector('#itemsTable tbody');
  tbody.innerHTML = '';
  items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${item.unit}</td>
      <td>${item.unit_price}</td>
      <td>${item.net_amount}</td>
      <td>${item.vat_amount}</td>
      <td>${item.gross_amount}</td>
      <td><button data-idx="${idx}" class="remove-item">🗑️</button></td>
    `;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.remove-item').forEach(btn => {
    btn.onclick = function() {
      items.splice(this.dataset.idx, 1);
      renderItems();
    };
  });
}

document.getElementById('invoiceForm').onsubmit = function(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(this).entries());
  data.total_amount = parseFloat(data.total_amount);
  data.vat_amount = parseFloat(data.vat_amount);
  fetch('/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(resp => {
    lastInvoiceId = resp.id;
    Promise.all(items.map(item =>
      fetch(`/invoices/${lastInvoiceId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      })
    )).then(() => {
      alert('Számla és tételek mentve!');
      items = [];
      renderItems();
      this.reset();
      loadInvoices();
    });
  });
};

function loadCustomers() {
  fetch('/customers')
    .then(res => res.json())
    .then(customers => {
      const ul = document.getElementById('customers');
      ul.innerHTML = '';
      customers.forEach(c => {
        const li = document.createElement('li');
        li.textContent = `${c.id}: ${c.name} (${c.address}, ${c.tax_number})`;
        ul.appendChild(li);
      });
    });
}

function loadInvoices() {
  fetch('/invoices')
    .then(res => res.json())
    .then(invoices => {
      const tbody = document.querySelector('#invoices tbody');
      tbody.innerHTML = '';
      invoices.forEach(inv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${inv.invoice_number}</td>
          <td>${inv.issuer_name}</td>
          <td>${inv.customer_name}</td>
          <td>${inv.issue_date}</td>
          <td>${inv.fulfillment_date}</td>
          <td>${inv.payment_deadline}</td>
          <td>${inv.total_amount}</td>
          <td>${inv.vat_amount}</td>
          <td>${inv.is_storno ? 'Stornózva' : 'Érvényes'}</td>
          <td>
            <button class="details-btn" data-id="${inv.id}">Részletek</button>
            <button class="storno-btn" data-id="${inv.id}" ${inv.is_storno ? 'disabled' : ''}>Stornózás</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      document.querySelectorAll('.details-btn').forEach(btn => {
        btn.onclick = function() {
          showInvoiceDetails(this.dataset.id);
        };
      });
      document.querySelectorAll('.storno-btn').forEach(btn => {
        btn.onclick = function() {
          if (this.disabled) return;
          if (confirm('Biztosan stornózod ezt a számlát?')) {
            fetch(`/api/invoices/${this.dataset.id}/storno`, { method: 'POST' })
              .then(res => res.json())
              .then(() => loadInvoices());
          }
        };
      });
    });
}

function showInvoiceDetails(invoiceId) {
  fetch(`/invoices/${invoiceId}`)
    .then(res => res.json())
    .then(inv => {
      fetch(`/invoices/${invoiceId}/items`)
        .then(res => res.json())
        .then(items => {
          const div = document.getElementById('invoiceDetails');
          div.innerHTML = `
            <h3>Számla: ${inv.invoice_number}</h3>
            <div><b>Kiállító:</b> ${inv.issuer_name}, ${inv.issuer_address}, ${inv.issuer_tax_number}</div>
            <div><b>Vevő:</b> ${inv.customer_name}, ${inv.customer_address}, ${inv.customer_tax_number}</div>
            <div><b>Kelte:</b> ${inv.issue_date}, <b>Teljesítés:</b> ${inv.fulfillment_date}, <b>Fizetési határidő:</b> ${inv.payment_deadline}</div>
            <div><b>Státusz:</b> ${inv.is_storno ? 'Stornózva' : 'Érvényes'}</div>
            <table>
              <thead>
                <tr>
                  <th>Név</th><th>Mennyiség</th><th>Egység</th><th>Egységár</th><th>Nettó</th><th>ÁFA</th><th>Bruttó</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>${item.unit}</td>
                    <td>${item.unit_price}</td>
                    <td>${item.net_amount}</td>
                    <td>${item.vat_amount}</td>
                    <td>${item.gross_amount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div><b>Végösszeg:</b> ${inv.total_amount} Ft, <b>ÁFA:</b> ${inv.vat_amount} Ft</div>
          `;
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
  loadCustomers();
  loadInvoices();
});