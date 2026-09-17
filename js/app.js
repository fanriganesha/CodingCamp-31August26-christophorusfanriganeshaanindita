(function () {
  'use strict';

  // ---------- State ----------
  const STORAGE_KEY = 'ledger.transactions';
  const CATEGORY_KEY = 'ledger.categories';
  const THEME_KEY = 'ledger.theme';
  const LIMIT_KEY = 'ledger.limit';

  const BASE_CATEGORIES = ['Food', 'Transport', 'Fun'];
  const PALETTE = ['#1f7a5c', '#3563c9', '#d98c2b', '#a35bd9', '#c1443a', '#2ba6a4', '#8a6d3b', '#5c8ac0'];

  let transactions = loadTransactions();
  let categories = loadCategories();
  let sortMode = 'date-desc';
  let chart = null;

  // ---------- Elements ----------
  const els = {
    form: document.getElementById('txForm'),
    itemName: document.getElementById('itemName'),
    amount: document.getElementById('amount'),
    category: document.getElementById('category'),
    formError: document.getElementById('formError'),
    balanceValue: document.getElementById('balanceValue'),
    limitStatus: document.getElementById('limitStatus'),
    limitInput: document.getElementById('limitInput'),
    txList: document.getElementById('txList'),
    emptyState: document.getElementById('emptyState'),
    chartCanvas: document.getElementById('spendChart'),
    chartEmptyState: document.getElementById('chartEmptyState'),
    chartLegend: document.getElementById('chartLegend'),
    sortSelect: document.getElementById('sortSelect'),
    manageCatToggle: document.getElementById('manageCatToggle'),
    customCatField: document.getElementById('customCatField'),
    customCatInput: document.getElementById('customCatInput'),
    addCustomCatBtn: document.getElementById('addCustomCatBtn'),
    themeToggle: document.getElementById('themeToggle'),
    monthlySummary: document.getElementById('monthlySummary'),
    summaryEmptyState: document.getElementById('summaryEmptyState'),
  };

  // ---------- Storage helpers ----------
  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to read transactions', e);
      return [];
    }
  }

  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.error('Failed to save transactions', e);
    }
  }

  function loadCategories() {
    try {
      const raw = localStorage.getItem(CATEGORY_KEY);
      const custom = raw ? JSON.parse(raw) : [];
      return BASE_CATEGORIES.concat(custom.filter(c => !BASE_CATEGORIES.includes(c)));
    } catch (e) {
      return BASE_CATEGORIES.slice();
    }
  }

  function saveCategories() {
    const custom = categories.filter(c => !BASE_CATEGORIES.includes(c));
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(custom));
  }

  function loadLimit() {
    const raw = localStorage.getItem(LIMIT_KEY);
    return raw ? parseFloat(raw) : null;
  }

  function saveLimit(value) {
    if (value === null || Number.isNaN(value)) {
      localStorage.removeItem(LIMIT_KEY);
    } else {
      localStorage.setItem(LIMIT_KEY, String(value));
    }
  }

  // ---------- Theme ----------
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    els.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }

  els.themeToggle.addEventListener('click', function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    renderChart(); // refresh chart colors/border for theme
  });

  // ---------- Categories ----------
  function renderCategoryOptions() {
    const current = els.category.value;
    els.category.innerHTML = '';
    categories.forEach(function (cat) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      els.category.appendChild(opt);
    });
    if (categories.includes(current)) els.category.value = current;
  }

  els.manageCatToggle.addEventListener('click', function () {
    const hidden = els.customCatField.hasAttribute('hidden');
    if (hidden) {
      els.customCatField.removeAttribute('hidden');
      els.customCatInput.focus();
    } else {
      els.customCatField.setAttribute('hidden', '');
    }
  });

  els.addCustomCatBtn.addEventListener('click', function () {
    const name = els.customCatInput.value.trim();
    if (!name) return;
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) {
      els.customCatInput.value = '';
      return;
    }
    categories.push(name);
    saveCategories();
    renderCategoryOptions();
    els.category.value = name;
    els.customCatInput.value = '';
    els.customCatField.setAttribute('hidden', '');
  });

  function categoryColor(cat) {
    const idx = categories.indexOf(cat);
    return PALETTE[idx % PALETTE.length] || PALETTE[0];
  }

  // ---------- Form ----------
  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = els.itemName.value.trim();
    const amountRaw = els.amount.value;
    const amount = parseFloat(amountRaw);
    const category = els.category.value;

    if (!name || !amountRaw || Number.isNaN(amount) || amount <= 0 || !category) {
      els.formError.textContent = 'Please fill in every field with a valid amount.';
      return;
    }
    els.formError.textContent = '';

    transactions.push({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name: name,
      amount: amount,
      category: category,
      date: new Date().toISOString(),
    });
    saveTransactions();

    els.itemName.value = '';
    els.amount.value = '';
    els.itemName.focus();

    renderAll();
  });

  els.txList.addEventListener('click', function (e) {
    const btn = e.target.closest('.tx-delete');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    renderAll();
  });

  // ---------- Sort ----------
  els.sortSelect.addEventListener('change', function () {
    sortMode = els.sortSelect.value;
    renderTransactionList();
  });

  function sortedTransactions() {
    const list = transactions.slice();
    switch (sortMode) {
      case 'date-asc':
        return list.sort((a, b) => new Date(a.date) - new Date(b.date));
      case 'amount-desc':
        return list.sort((a, b) => b.amount - a.amount);
      case 'amount-asc':
        return list.sort((a, b) => a.amount - b.amount);
      case 'category':
        return list.sort((a, b) => a.category.localeCompare(b.category) || new Date(b.date) - new Date(a.date));
      case 'date-desc':
      default:
        return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  }

  // ---------- Limit ----------
  const savedLimit = loadLimit();
  if (savedLimit !== null) els.limitInput.value = savedLimit;

  els.limitInput.addEventListener('input', function () {
    const val = parseFloat(els.limitInput.value);
    saveLimit(els.limitInput.value === '' ? null : val);
    renderBalance();
  });

  // ---------- Render: balance ----------
  function renderBalance() {
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    els.balanceValue.textContent = formatCurrency(total);
    els.balanceValue.classList.toggle('negative', total < 0);

    const limit = loadLimit();
    if (limit && limit > 0) {
      const pct = Math.round((total / limit) * 100);
      const over = total > limit;
      els.limitStatus.textContent = over
        ? 'Over your $' + limit.toFixed(2) + ' limit by ' + formatCurrency(total - limit)
        : pct + '% of your $' + limit.toFixed(2) + ' monthly limit';
      els.limitStatus.classList.toggle('over', over);
    } else {
      els.limitStatus.textContent = '';
      els.limitStatus.classList.remove('over');
    }
  }

  // ---------- Render: transaction list ----------
  function renderTransactionList() {
    const list = sortedTransactions();
    els.txList.innerHTML = '';
    els.emptyState.style.display = list.length ? 'none' : 'block';

    list.forEach(function (t) {
      const li = document.createElement('li');
      li.className = 'tx-item';
      li.innerHTML =
        '<div class="tx-main">' +
          '<p class="tx-name">' + escapeHtml(t.name) + '</p>' +
          '<span class="tx-cat">' + escapeHtml(t.category) + '</span>' +
        '</div>' +
        '<span class="tx-amount">' + formatCurrency(t.amount) + '</span>' +
        '<button class="tx-delete" data-id="' + t.id + '" aria-label="Delete ' + escapeHtml(t.name) + '">&times;</button>';
      els.txList.appendChild(li);
    });
  }

  // ---------- Render: chart ----------
  function renderChart() {
    const totalsByCategory = {};
    transactions.forEach(function (t) {
      totalsByCategory[t.category] = (totalsByCategory[t.category] || 0) + t.amount;
    });

    const labels = Object.keys(totalsByCategory);
    const data = labels.map(l => totalsByCategory[l]);
    const colors = labels.map(categoryColor);

    els.chartEmptyState.style.display = labels.length ? 'none' : 'block';
    els.chartCanvas.style.display = labels.length ? 'block' : 'none';

    if (chart) {
      chart.destroy();
      chart = null;
    }

    if (!labels.length) {
      els.chartLegend.innerHTML = '';
      return;
    }

    const style = getComputedStyle(document.documentElement);
    chart = new Chart(els.chartCanvas, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: style.getPropertyValue('--paper-raised').trim(),
          borderWidth: 2,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        responsive: true,
        maintainAspectRatio: true,
      },
    });

    const total = data.reduce((a, b) => a + b, 0);
    els.chartLegend.innerHTML = labels.map(function (label, i) {
      const pct = total ? Math.round((data[i] / total) * 100) : 0;
      return '<li><span class="legend-label"><span class="dot" style="background:' + colors[i] + '"></span>' + escapeHtml(label) + '</span><span>' + pct + '%</span></li>';
    }).join('');
  }

  // ---------- Render: monthly summary ----------
  function renderMonthlySummary() {
    const now = new Date();
    const thisMonth = transactions.filter(function (t) {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    if (!thisMonth.length) {
      els.monthlySummary.innerHTML = '';
      els.summaryEmptyState.style.display = 'block';
      return;
    }
    els.summaryEmptyState.style.display = 'none';

    const total = thisMonth.reduce((s, t) => s + t.amount, 0);
    const count = thisMonth.length;
    const avg = total / count;
    const byCat = {};
    thisMonth.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const topCat = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0];

    const items = [
      { val: formatCurrency(total), lab: 'Spent this month' },
      { val: String(count), lab: 'Transactions' },
      { val: formatCurrency(avg), lab: 'Average per item' },
      { val: topCat, lab: 'Top category' },
    ];

    els.monthlySummary.innerHTML = items.map(function (item) {
      return '<div class="summary-item"><div class="val">' + escapeHtml(item.val) + '</div><div class="lab">' + item.lab + '</div></div>';
    }).join('');
  }

  // ---------- Utils ----------
  function formatCurrency(n) {
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toFixed(2);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Render all ----------
  function renderAll() {
    renderBalance();
    renderTransactionList();
    renderChart();
    renderMonthlySummary();
  }

  // ---------- Init ----------
  initTheme();
  renderCategoryOptions();
  renderAll();
})();
