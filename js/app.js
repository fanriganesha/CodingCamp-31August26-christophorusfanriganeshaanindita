let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let chartInstance = null;

const form = document.getElementById('transaction-form');
const nameInput = document.getElementById('item-name');
const amountInput = document.getElementById('item-amount');
const categoryInput = document.getElementById('item-category');
const totalDisplay = document.getElementById('total-balance');
const listContainer = document.getElementById('transaction-list');

document.addEventListener('DOMContentLoaded', () => {
  renderApp();
  initChart();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categoryInput.value;

  if (name && amount && category) {
    transactions.push({ id: Date.now(), name, amount, category });
    saveAndRender();
    form.reset();
  }
});

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveAndRender();
}

function saveAndRender() {
  localStorage.setItem('transactions', JSON.stringify(transactions));
  renderApp();
  updateChart();
}

function renderApp() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  totalDisplay.textContent = `$${total.toFixed(2)}`;

  listContainer.innerHTML = '';
  transactions.forEach(t => {
    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.innerHTML = `
      <div>
        <div class="item-title">${t.name}</div>
        <div class="item-amount">$${t.amount.toFixed(2)}</div>
        <span class="category-tag">${t.category}</span>
      </div>
      <button class="btn-delete" onclick="deleteTransaction(${t.id})">Delete</button>
    `;
    listContainer.appendChild(item);
  });
}

function initChart() {
  const ctx = document.getElementById('spending-chart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'pie',
    data: getChartData(),
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function updateChart() {
  if (chartInstance) {
    chartInstance.data = getChartData();
    chartInstance.update();
  }
}

function getChartData() {
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach(t => {
    if (totals[t.category] !== undefined) {
      totals[t.category] += t.amount;
    }
  });

  return {
    labels: ['Food', 'Transport', 'Fun'],
    datasets: [{
      data: [totals.Food, totals.Transport, totals.Fun],
      backgroundColor: ['#2ecc71', '#3498db', '#e67e22']
    }]
  };
}