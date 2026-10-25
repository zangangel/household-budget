const STORAGE_KEY = 'household-budget.transactions.v1';
const EXPENSE_CATEGORIES = ['식비', '교통', '주거', '생활', '건강', '여가', '쇼핑', '기타'];
const INCOME_CATEGORIES = ['급여', '부수입', '환급', '기타'];

const form = document.querySelector('#transaction-form');
const monthFilter = document.querySelector('#month-filter');
const categorySelect = document.querySelector('#category');
const transactionList = document.querySelector('#transaction-list');

let transactions = loadTransactions();

const today = new Date();
const currentMonth = today.toISOString().slice(0, 7);
monthFilter.value = currentMonth;
document.querySelector('#date').value = today.toISOString().slice(0, 10);
updateCategoryOptions();
render();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const amount = Number(data.get('amount'));

  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  transactions.push({
    id: crypto.randomUUID(),
    type: data.get('type'),
    amount,
    date: data.get('date'),
    category: data.get('category'),
    memo: String(data.get('memo') || '').trim(),
    createdAt: new Date().toISOString(),
  });

  persistTransactions();
  form.reset();
  document.querySelector('#date').value = today.toISOString().slice(0, 10);
  document.querySelector('input[name="type"][value="expense"]').checked = true;
  updateCategoryOptions();
  render();
});

form.addEventListener('change', (event) => {
  if (event.target.name === 'type') {
    updateCategoryOptions();
  }
});

monthFilter.addEventListener('change', render);

transactionList.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('[data-delete-id]');
  if (!deleteButton) return;

  transactions = transactions.filter((transaction) => transaction.id !== deleteButton.dataset.deleteId);
  persistTransactions();
  render();
});

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function persistTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function updateCategoryOptions() {
  const type = new FormData(form).get('type');
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  categorySelect.innerHTML = categories.map((category) => `<option value="${category}">${category}</option>`).join('');
}

function render() {
  const selectedMonth = monthFilter.value;
  const visibleTransactions = transactions
    .filter((transaction) => transaction.date.startsWith(selectedMonth))
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));

  const income = visibleTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const expense = visibleTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + transaction.amount, 0);

  document.querySelector('#income-total').textContent = formatCurrency(income);
  document.querySelector('#expense-total').textContent = formatCurrency(expense);
  document.querySelector('#balance-total').textContent = formatCurrency(income - expense);
  document.querySelector('#transaction-count').textContent = `${visibleTransactions.length}건`;

  if (visibleTransactions.length === 0) {
    transactionList.innerHTML = '<div class="empty-state"><span>✦</span><p>아직 기록이 없어요.</p><small>왼쪽에서 첫 내역을 추가해 보세요.</small></div>';
    return;
  }

  transactionList.innerHTML = visibleTransactions.map((transaction) => `
    <div class="transaction-row">
      <div class="transaction-icon ${transaction.type}">${transaction.type === 'income' ? '↗' : '↘'}</div>
      <div class="transaction-info">
        <strong>${escapeHtml(transaction.memo || transaction.category)}</strong>
        <span>${escapeHtml(transaction.category)} · ${formatDate(transaction.date)}</span>
      </div>
      <div class="transaction-amount ${transaction.type}">
        <strong>${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}</strong>
        <button type="button" class="delete-button" data-delete-id="${transaction.id}" aria-label="${escapeHtml(transaction.memo || transaction.category)} 삭제">삭제</button>
      </div>
    </div>
  `).join('');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

