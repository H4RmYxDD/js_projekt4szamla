function loadInvoices(customerId) {
  document.querySelectorAll('#customers li').forEach(li => li.style.fontWeight = 'normal');
  const ul = document.getElementById('customers');
  Array.from(ul.children).forEach(li => {
    if (li.dataset.id == customerId) li.style.fontWeight = 'bold';
  });

  fetch(`/customers/${customerId}/invoices`)
    .then(res => res.json())
    .then(invoices => {
      const tbody = document.querySelector('#invoices tbody');
      tbody.innerHTML = '';
      invoices.forEach(inv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <b>${inv.issuer_name || ''}</b><br>
            ${inv.issuer_address || ''}<br>
            ${inv.issuer_tax_number || ''}
          </td>
          <td>${inv.invoice_number}</td>
          <td>${inv.issue_date}</td>
          <td>${inv.fulfillment_date}</td>
          <td>${inv.payment_deadline}</td>
          <td>${inv.total_amount}</td>
          <td>${inv.vat_amount}</td>
        `;
        tbody.appendChild(tr);
      });
    });
}
function loadIssuers() {
  fetch('/issuers')
    .then(res => res.json())
    .then(issuers => {
      const ul = document.getElementById('issuers');
      ul.innerHTML = '';
      issuers.forEach(issuer => {
        const li = document.createElement('li');
        li.textContent = `${issuer.id}: ${issuer.name}`;
        li.style.cursor = 'pointer';
        li.onclick = () => {
          document.querySelectorAll('#issuers li').forEach(li2 => li2.style.fontWeight = 'normal');
          li.style.fontWeight = 'bold';
          loadInvoicesByIssuer(issuer.id);
        };
        ul.appendChild(li);
      });
    });
}
function loadCustomers() {
  fetch('/customers')
    .then(res => res.json())
    .then(customers => {
      const ul = document.getElementById('customers');
      ul.innerHTML = '';
      customers.forEach((c, idx) => {
        const li = document.createElement('li');
        li.dataset.id = c.id; 
li.innerHTML = `
  <span class="customer-view">
    ${c.id}: <span class="name">${c.name}</span> (<span class="address">${c.address}</span>, <span class="tax">${c.tax_number}</span>)
    <div class="customer-actions" style="margin-top:4px;">
      <button class="edit-btn" data-id="${c.id}">✏️</button>
      <button class="delete-btn" data-id="${c.id}">🗑️</button>
    </div>
  </span>
`;
        li.style.cursor = 'pointer';
        li.onclick = (e) => {
          if (e.target.tagName === 'BUTTON') return;
          loadInvoices(c.id);
        };
        ul.appendChild(li);

        if (idx === 0) {
          loadInvoices(c.id);
          li.style.fontWeight = 'bold';
        }

        // Törlés
        li.querySelector('.delete-btn').onclick = function(e) {
          e.stopPropagation();
          if (confirm('Biztosan törlöd?')) {
            fetch(`/customers/${c.id}`, { method: 'DELETE' })
              .then(() => loadCustomers())
              loadIssuers();
          }
        };

        // Szerkesztés
        li.querySelector('.edit-btn').onclick = function(e) {
          e.stopPropagation();
          // Átvált szerkesztő módba
          li.innerHTML = `
            <form class="edit-form">
              <input type="text" name="name" value="${c.name}" required s">
              <input type="text" name="address" value="${c.address}" required ">
              <input type="text" name="tax_number" value="${c.tax_number}" required ">
              <button type="submit">💾</button>
              <button type="button" class="cancel-btn">✖️</button>
            </form>
          `;
          const form = li.querySelector('.edit-form');
          form.onsubmit = function(ev) {
            ev.preventDefault();
            const data = Object.fromEntries(new FormData(form).entries());
            fetch(`/customers/${c.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            }).then(() => loadCustomers());
          };
          li.querySelector('.cancel-btn').onclick = function() {
            loadCustomers();
          };
        };
      });
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
    alert('Számla mentve! ID: ' + resp.id);
    loadInvoices(data.customer_id);
  });
};

fetch('/issuers')
  .then(res => res.json())
  .then(issuers => {
    const ul = document.getElementById('issuers');
    ul.innerHTML = '';
    issuers.forEach(issuer => {
      const li = document.createElement('li');
      li.textContent = `${issuer.id}: ${issuer.name}`;
      li.style.cursor = 'pointer';
      li.onclick = () => {
        // Minden kiállító visszaállítása normálra
        document.querySelectorAll('#issuers li').forEach(li2 => li2.style.fontWeight = 'normal');
        // Aktuális kiemelése
        li.style.fontWeight = 'bold';
        loadInvoicesByIssuer(issuer.id);
      };
      ul.appendChild(li);
    });
  });

function loadInvoicesByIssuer(issuerId) {
  fetch(`/issuers/${issuerId}/invoices`)
    .then(res => res.json())
    .then(invoices => {
      const tbody = document.querySelector('#invoices tbody');
      tbody.innerHTML = '';
      invoices.forEach(inv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <b>${inv.issuer_name || ''}</b><br>
            ${inv.issuer_address || ''}<br>
            ${inv.issuer_tax_number || ''}
          </td>
          <td>${inv.invoice_number}</td>
          <td>${inv.issue_date}</td>
          <td>${inv.fulfillment_date}</td>
          <td>${inv.payment_deadline}</td>
          <td>${inv.total_amount}</td>
          <td>${inv.vat_amount}</td>
        `;
        tbody.appendChild(tr);
      });
    });
}

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
    loadIssuers();
  });
};

loadCustomers();