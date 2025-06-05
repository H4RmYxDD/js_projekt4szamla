let lastInvoiceId = null;

document.getElementById('customerForm').onsubmit = function(e) {
  e.preventDefault();
  const errorDiv = document.getElementById('customerError');
  if (errorDiv) {
    errorDiv.classList.remove('active');
    errorDiv.textContent = '';
  }

  const name = this.name.value.trim();
  const address = this.address.value.trim();
  const tax_number = this.tax_number.value.trim();

  if (!name || !address || !tax_number) {
    if (errorDiv) {
      errorDiv.textContent = 'Minden mező kitöltése kötelező!';
      errorDiv.classList.add('active');
    }
    return;
  }
  if (!/^\d{8}-\d-\d{2}$/.test(tax_number)) {
    if (errorDiv) {
      errorDiv.textContent = 'Az adószám formátuma hibás! (pl. 12345678-1-12)';
      errorDiv.classList.add('active');
    }
    return;
  }

  const data = { name, address, tax_number };
  fetch('/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(resp => {
    if (resp.error && errorDiv) {
      errorDiv.textContent = resp.error;
      errorDiv.classList.add('active');
    } else {
      this.reset();
      loadCustomers();
    }
  })
  .catch(() => {
    if (errorDiv) {
      errorDiv.textContent = 'Hiba történt a vevő mentésekor.';
      errorDiv.classList.add('active');
    }
  });
};

document.getElementById('invoiceForm').onsubmit = function(e) {
  e.preventDefault();
  const errorDiv = document.getElementById('invoiceError');
  if (errorDiv) {
    errorDiv.classList.remove('active');
    errorDiv.textContent = '';
  }

  const data = Object.fromEntries(new FormData(this).entries());
  if (!data.issuer_id || !data.customer_id) {
    if (errorDiv) {
      errorDiv.textContent = 'Kiállító és vevő kiválasztása kötelező!';
      errorDiv.classList.add('active');
    }
    return;
  }
  if (data.issuer_id === data.customer_id) {
    if (errorDiv) {
      errorDiv.textContent = 'A kiállító és a vevő nem lehet ugyanaz!';
      errorDiv.classList.add('active');
    }
    return;
  }
  if (!data.issue_date || !data.fulfillment_date || !data.payment_deadline) {
    if (errorDiv) {
      errorDiv.textContent = 'Minden dátum megadása kötelező!';
      errorDiv.classList.add('active');
    }
    return;
  }
  if (!data.total_amount || isNaN(data.total_amount) || Number(data.total_amount) <= 0) {
    if (errorDiv) {
      errorDiv.textContent = 'A végösszegnek pozitív számnak kell lennie!';
      errorDiv.classList.add('active');
    }
    return;
  }
  if (!data.vat_amount || isNaN(data.vat_amount) || Number(data.vat_amount) < 0) {
    if (errorDiv) {
      errorDiv.textContent = 'Az ÁFA nem lehet negatív!';
      errorDiv.classList.add('active');
    }
    return;
  }

  data.total_amount = parseFloat(data.total_amount);
  data.vat_amount = parseFloat(data.vat_amount);

  fetch('/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(resp => {
    if (resp.error && errorDiv) {
      errorDiv.textContent = resp.error;
      errorDiv.classList.add('active');
    } else {
      lastInvoiceId = resp.id;
      alert('Számla mentve!');
      this.reset();
      loadInvoices();
      generateInvoiceNumber();
    }
  })
  .catch(() => {
    if (errorDiv) {
      errorDiv.textContent = 'Hiba történt a számla mentésekor.';
      errorDiv.classList.add('active');
    }
  });
};

function fillCustomerSelects(customers) {
  const issuerSelect = document.getElementById('issuerSelect');
  const customerSelect = document.getElementById('customerSelect');
  issuerSelect.innerHTML = '<option value="">Kiállító kiválasztása</option>';
  customerSelect.innerHTML = '<option value="">Vevő kiválasztása</option>';
  customers.forEach(c => {
    const option1 = document.createElement('option');
    option1.value = c.id;
    option1.textContent = `${c.name} (${c.address})`;
    issuerSelect.appendChild(option1);

    const option2 = document.createElement('option');
    option2.value = c.id;
    option2.textContent = `${c.name} (${c.address})`;
    customerSelect.appendChild(option2);
  });
  generateInvoiceNumber();
}

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
      fillCustomerSelects(customers);
    });
}

function loadInvoices() {
  fetch('/invoices')
    .then(res => res.json())
    .then(invoices => {
      const tbody = document.querySelector('#invoices tbody');
      tbody.innerHTML = '';
      invoices
        .filter(inv => !inv.invoice_number.endsWith('-ST'))
        .forEach(inv => {
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
      const netAmount = (inv.total_amount - inv.vat_amount).toFixed(2);
      const vatAmount = Number(inv.vat_amount).toFixed(2);
      const grossAmount = Number(inv.total_amount).toFixed(2);

      const grossInWords = numberToHungarianWords(Math.round(inv.total_amount));

      const div = document.getElementById('invoiceDetails');
      div.innerHTML = `
  <div class="invoice-official">
    <h2 style="text-align:center;margin-bottom:1em;">Számla</h2>
    <div style="display: flex; flex-wrap: wrap; gap: 2em;">
      <div style="flex: 1 1 220px; min-width: 200px;">
        <h4>Eladó (kiállító)</h4>
        <div><b>Név:</b> ${inv.issuer_name}</div>
        <div><b>Cím:</b> ${inv.issuer_address}</div>
        <div><b>Adószám:</b> ${inv.issuer_tax_number}</div>
      </div>
      <div style="flex: 1 1 220px; min-width: 200px;">
        <h4>Vevő</h4>
        <div><b>Név:</b> ${inv.customer_name}</div>
        <div><b>Cím:</b> ${inv.customer_address}</div>
        <div><b>Adószám:</b> ${inv.customer_tax_number}</div>
      </div>
    </div>
    <hr style="margin:1.2em 0;">
    <div style="display: flex; flex-wrap: wrap; gap: 2em;">
      <div style="flex: 1 1 220px; min-width: 200px;">
        <div><b>Számla sorszáma:</b> ${inv.invoice_number}</div>
        <div><b>Számla kelte:</b> ${inv.issue_date}</div>
        <div><b>Teljesítés dátuma:</b> ${inv.fulfillment_date}</div>
        <div><b>Fizetési határidő:</b> ${inv.payment_deadline}</div>
        <div><b>Számla státusza:</b> ${inv.is_storno ? 'Stornózva' : 'Érvényes'}</div>
      </div>
      <div style="flex: 1 1 220px; min-width: 200px;">
        <div style="margin-top:1em;">
          <b>Nettó ár:</b> ${netAmount} Ft<br>
          <b>ÁFA:</b> ${vatAmount} Ft<br>
          <b>Bruttó ár:</b> ${grossAmount} Ft<br>
          <span style="font-size:0.95em;color:#555"><i>${grossInWords}</i></span>
        </div>
      </div>
    </div>
  </div>
      `;
    });
}
function numberToHungarianWords(num) {
  const ones = ['', 'egy', 'kettő', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];
  const tens = ['', 'tíz', 'húsz', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'];
  const teens = ['tíz', 'tizenegy', 'tizenkettő', 'tizenhárom', 'tizennégy', 'tizenöt', 'tizenhat', 'tizenhét', 'tizennyolc', 'tizenkilenc'];

  if (num === 0) return 'nulla forint';

  let n = Math.floor(num);
  let parts = [];

  if (n >= 1000000) {
    const mill = Math.floor(n / 1000000);
    parts.push(numberToHungarianWords(mill).replace(' forint', '') + 'millió');
    n %= 1000000;
  }
  if (n >= 1000) {
    const ez = Math.floor(n / 1000);
    if (ez > 1) {
      parts.push(numberToHungarianWords(ez).replace(' forint', '') + 'ezer');
    } else if (ez === 1) {
      parts.push('ezer');
    }
    n %= 1000;
  }
  if (n >= 100) {
    const sz = Math.floor(n / 100);
    if (sz > 1) {
      parts.push(ones[sz] + 'száz');
    } else {
      parts.push('száz');
    }
    n %= 100;
  }
  if (n >= 20) {
    parts.push(tens[Math.floor(n / 10)]);
    n %= 10;
  }
  if (n >= 10) {
    parts.push(teens[n - 10]);
    n = 0;
  }
  if (n > 0) {
    parts.push(ones[n]);
  }

  let result = parts.join('-').replace(/--+/g, '-').replace(/^-|-$/g, '');
  return result + ' forint';
}

document.getElementById('customerSelect').addEventListener('change', generateInvoiceNumber);

function generateInvoiceNumber() {
  const customerSelect = document.getElementById('customerSelect');
  const invoiceNumberInput = document.getElementById('invoice_number');
  const selectedOption = customerSelect.options[customerSelect.selectedIndex];
  if (!selectedOption || !selectedOption.value) {
    invoiceNumberInput.value = '';
    return;
  }
  let name = selectedOption.textContent.split(' (')[0]
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_');
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0');
  invoiceNumberInput.value = `${name}-${dateStr}`;
}

document.addEventListener('DOMContentLoaded', () => {
  loadCustomers();
  loadInvoices();
});