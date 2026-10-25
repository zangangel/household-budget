import { hasSupabaseConfig, supabase } from './lib/supabase.js';

const EXPENSE_CATEGORIES = ['식비', '주거', '교통', '교육', '의료', '생활', '여가', '쇼핑', '기타'];
const INCOME_CATEGORIES = ['급여', '부수입', '환급', '기타'];
const LEGACY_STORAGE_KEY = 'household-budget.transactions.v1';

const state = {
  user: null,
  session: null,
  household: null,
  currentMember: null,
  members: [],
  transactions: [],
  budgets: [],
  recurringTemplates: [],
  benchmarks: [],
  periodType: 'month',
  periodDate: todayMonth(),
  channel: null,
};

const $ = (selector) => document.querySelector(selector);

document.addEventListener('DOMContentLoaded', boot);

async function boot() {
  bindEvents();

  if (!hasSupabaseConfig) {
    showOnly('config-view');
    return;
  }

  showOnly('auth-view');
  const { data } = await supabase.auth.getSession();
  await applySession(data.session);
  supabase.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => applySession(session), 0);
  });
}

function bindEvents() {
  $('#auth-form').addEventListener('submit', sendMagicLink);
  $('#create-household-form').addEventListener('submit', createHousehold);
  $('#join-household-form').addEventListener('submit', joinHousehold);
  $('#sign-out-button').addEventListener('click', () => supabase.auth.signOut());
  $('#transaction-form').addEventListener('submit', saveTransaction);
  $('#transaction-form').addEventListener('change', (event) => {
    if (event.target.name === 'type') updateCategoryOptions();
  });
  $('#details-toggle').addEventListener('click', toggleDetails);
  $('#period-type').addEventListener('change', (event) => {
    state.periodType = event.target.value;
    loadData().catch(handleError);
  });
  $('#period-date').addEventListener('change', (event) => {
    state.periodDate = event.target.value || todayMonth();
    loadData().catch(handleError);
  });
  $('#transaction-list').addEventListener('click', handleTransactionAction);
  $('#edit-form').addEventListener('submit', updateTransaction);
  $('#close-edit-button').addEventListener('click', () => $('#edit-dialog').close());
  $('#budget-form').addEventListener('submit', saveBudget);
  $('#recurring-form').addEventListener('submit', saveRecurringTemplate);
  $('#family-member-form').addEventListener('submit', addDaughter);
  $('#copy-code-button').addEventListener('click', copyJoinCode);
}

async function applySession(session) {
  state.session = session;
  state.user = session?.user || null;

  if (!state.user) {
    state.household = null;
    state.currentMember = null;
    if (state.channel) await supabase.removeChannel(state.channel);
    state.channel = null;
    showOnly('auth-view');
    return;
  }

  try {
    await loadWorkspace();
  } catch (error) {
    handleError(error);
  }
}

async function loadWorkspace() {
  const { data: member, error } = await supabase
    .from('household_members')
    .select('*, households(*)')
    .eq('user_id', state.user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!member) {
    showOnly('onboarding-view');
    return;
  }

  state.currentMember = member;
  state.household = member.households;
  await loadData();
  subscribeToChanges();
  showOnly('app-view');
}

async function loadData() {
  if (!state.household) return;

  await supabase.rpc('generate_due_transactions', { target_household: state.household.id });
  const { start, end, monthStart } = getPeriodRange();

  const [membersResult, transactionsResult, budgetsResult, recurringResult, benchmarksResult] = await Promise.all([
    supabase.from('household_members').select('*').eq('household_id', state.household.id).order('created_at'),
    supabase.from('transactions').select('*').eq('household_id', state.household.id).gte('transaction_date', start).lte('transaction_date', end).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('budgets').select('*').eq('household_id', state.household.id).gte('month_start', start).lte('month_start', end),
    supabase.from('recurring_templates').select('*').eq('household_id', state.household.id).order('next_due_date'),
    supabase.from('benchmark_snapshots').select('*').eq('household_size', 3).order('period_end', { ascending: false }),
  ]);

  const failed = [membersResult, transactionsResult, budgetsResult, recurringResult, benchmarksResult].find((result) => result.error);
  if (failed) throw failed.error;

  state.members = membersResult.data || [];
  state.transactions = transactionsResult.data || [];
  state.budgets = budgetsResult.data || [];
  state.recurringTemplates = recurringResult.data || [];
  state.benchmarks = benchmarksResult.data || [];
  await migrateLegacyTransactions();
  render();
}

function subscribeToChanges() {
  if (state.channel) supabase.removeChannel(state.channel);

  state.channel = supabase
    .channel(`household-${state.household.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `household_id=eq.${state.household.id}` }, () => loadData().catch(handleError))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `household_id=eq.${state.household.id}` }, () => loadData().catch(handleError))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${state.household.id}` }, () => loadData().catch(handleError))
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') showToast('실시간 연결에 실패했습니다. 새로고침해 주세요.', 'error');
    });
}

async function sendMagicLink(event) {
  event.preventDefault();
  const email = $('#auth-email').value.trim();
  const button = event.submitter;
  setBusy(button, true, '전송 중…');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
  setBusy(button, false, '로그인 링크 받기');
  if (error) return handleError(error);
  showToast('로그인 링크를 이메일로 보냈습니다.');
}

async function createHousehold(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const { error } = await supabase.rpc('create_household', {
    household_name: formData.get('name'),
    member_name: formData.get('memberName'),
    member_relationship: formData.get('relationship'),
  });
  if (error) return handleError(error);
  await loadWorkspace();
  showToast('가구를 만들었습니다. 참여 코드를 배우자에게 공유하세요.');
}

async function joinHousehold(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const { error } = await supabase.rpc('join_household', {
    household_join_code: formData.get('joinCode'),
    member_name: formData.get('memberName'),
    member_relationship: formData.get('relationship'),
  });
  if (error) return handleError(error);
  await loadWorkspace();
  showToast('가구에 참여했습니다.');
}

async function saveTransaction(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const amount = Number(formData.get('amount'));
  if (!Number.isInteger(amount) || amount <= 0) return showToast('금액은 1원 이상의 정수로 입력해 주세요.', 'error');

  const payload = {
    household_id: state.household.id,
    type: formData.get('type'),
    amount,
    transaction_date: formData.get('transaction_date'),
    category: formData.get('category') || '미분류',
    memo: String(formData.get('memo') || '').trim(),
    payer_member_id: formData.get('payer_member_id'),
    recorded_by: state.user.id,
    cost_type: formData.get('cost_type') || 'variable',
    status: 'confirmed',
    source: 'web',
  };

  const button = event.submitter;
  setBusy(button, true, '저장 중…');
  const { error } = await supabase.from('transactions').insert(payload);
  setBusy(button, false, '바로 저장하기');
  if (error) return handleError(error);

  resetTransactionForm();
  showToast('저장했습니다. 배우자의 화면에도 반영됩니다.');
  await loadData();
}

function resetTransactionForm() {
  const form = $('#transaction-form');
  form.reset();
  $('#date').value = todayDate();
  $('#payer').value = state.currentMember?.id || state.members[0]?.id || '';
  $('#details-fields').hidden = true;
  $('#details-toggle').setAttribute('aria-expanded', 'false');
  updateCategoryOptions();
  $('#amount').focus();
}

function toggleDetails() {
  const fields = $('#details-fields');
  const expanded = fields.hidden;
  fields.hidden = !expanded;
  $('#details-toggle').setAttribute('aria-expanded', String(expanded));
  $('#details-toggle').classList.toggle('is-open', expanded);
}

function handleTransactionAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const transaction = state.transactions.find((item) => item.id === button.dataset.id);
  if (!transaction) return;
  if (button.dataset.action === 'edit') openEditDialog(transaction);
  if (button.dataset.action === 'delete') deleteTransaction(transaction);
}

function openEditDialog(transaction) {
  const form = $('#edit-form');
  form.elements.id.value = transaction.id;
  form.elements.amount.value = transaction.amount;
  form.elements.transaction_date.value = transaction.transaction_date;
  form.elements.category.innerHTML = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])].map((category) => `<option value="${category}">${category}</option>`).join('');
  form.elements.category.value = transaction.category;
  form.elements.payer_member_id.innerHTML = memberOptions(transaction.payer_member_id);
  form.elements.cost_type.value = transaction.cost_type;
  form.elements.memo.value = transaction.memo || '';
  $('#edit-dialog').showModal();
}

async function updateTransaction(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const amount = Number(formData.get('amount'));
  const { error } = await supabase.from('transactions').update({
    amount,
    transaction_date: formData.get('transaction_date'),
    category: formData.get('category'),
    payer_member_id: formData.get('payer_member_id'),
    cost_type: formData.get('cost_type'),
    memo: String(formData.get('memo') || '').trim(),
    updated_at: new Date().toISOString(),
  }).eq('id', formData.get('id')).eq('household_id', state.household.id);
  if (error) return handleError(error);
  $('#edit-dialog').close();
  showToast('내역을 수정했습니다.');
  await loadData();
}

async function deleteTransaction(transaction) {
  if (!window.confirm(`${transaction.memo || transaction.category} 내역을 삭제할까요?`)) return;
  const { error } = await supabase.from('transactions').delete().eq('id', transaction.id).eq('household_id', state.household.id);
  if (error) return handleError(error);
  showToast('내역을 삭제했습니다.');
  await loadData();
}

async function saveBudget(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const amount = Number(formData.get('amount'));
  if (!Number.isInteger(amount) || amount <= 0) return showToast('예산은 1원 이상의 정수로 입력해 주세요.', 'error');
  const { monthStart } = getPeriodRange();
  const { error } = await supabase.from('budgets').upsert({
    household_id: state.household.id,
    month_start: monthStart,
    category: formData.get('category'),
    amount,
    created_by: state.user.id,
  }, { onConflict: 'household_id,month_start,category' });
  if (error) return handleError(error);
  event.currentTarget.reset();
  showToast('예산을 설정했습니다.');
  await loadData();
}

async function saveRecurringTemplate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const day = Number(formData.get('day_of_month'));
  const amount = Number(formData.get('amount'));
  if (!Number.isInteger(amount) || amount <= 0 || day < 1 || day > 28) return showToast('금액과 날짜를 확인해 주세요.', 'error');
  const { error } = await supabase.from('recurring_templates').insert({
    household_id: state.household.id,
    type: 'expense',
    amount,
    category: formData.get('category'),
    memo: String(formData.get('memo') || '').trim(),
    payer_member_id: formData.get('payer_member_id'),
    cost_type: 'fixed',
    day_of_month: day,
    next_due_date: nextDueDate(day),
    created_by: state.user.id,
  });
  if (error) return handleError(error);
  event.currentTarget.reset();
  showToast('반복비를 추가했습니다.');
  await loadData();
}

async function addDaughter(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const { error } = await supabase.rpc('add_family_member', {
    target_household: state.household.id,
    member_name: formData.get('memberName'),
    member_relationship: 'daughter',
  });
  if (error) return handleError(error);
  event.currentTarget.reset();
  showToast('가족 구성원을 추가했습니다.');
  await loadData();
}

async function copyJoinCode() {
  await navigator.clipboard.writeText(state.household.join_code);
  showToast('참여 코드를 복사했습니다.');
}

async function migrateLegacyTransactions() {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw || state.transactions.length > 0) return;
  let legacy;
  try { legacy = JSON.parse(raw); } catch { return; }
  if (!Array.isArray(legacy) || legacy.length === 0) return;

  const rows = legacy.filter((item) => item?.date && Number(item.amount) > 0).map((item) => ({
    household_id: state.household.id,
    type: item.type === 'income' ? 'income' : 'expense',
    amount: Math.round(Number(item.amount)),
    transaction_date: item.date,
    category: item.category || '미분류',
    memo: item.memo || '',
    payer_member_id: state.currentMember.id,
    recorded_by: state.user.id,
    cost_type: 'variable',
    status: 'confirmed',
    source: 'import',
  }));
  if (!rows.length) return;
  const { data: imported, error } = await supabase.from('transactions').insert(rows).select();
  if (!error) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    state.transactions = imported || [];
    showToast(`${rows.length}건의 기존 기록을 공동장부로 옮겼습니다.`);
  }
}

function render() {
  if (!state.household) return;
  const { monthStart } = getPeriodRange();
  const income = sum(state.transactions.filter((item) => item.type === 'income'), 'amount');
  const expenses = state.transactions.filter((item) => item.type === 'expense');
  const expense = sum(expenses, 'amount');
  const fixed = sum(expenses.filter((item) => item.cost_type === 'fixed'), 'amount');
  const variable = sum(expenses.filter((item) => item.cost_type !== 'fixed'), 'amount');
  const budgetTotal = sum(state.budgets, 'amount');

  $('#household-name').textContent = `● ${state.household.name}`;
  $('#user-name').textContent = state.currentMember?.display_name || state.user.email;
  $('#period-type').value = state.periodType;
  $('#period-date').value = state.periodDate;
  $('#period-label').textContent = `${periodLabel()} 내역`;
  $('#income-total').textContent = formatCurrency(income);
  $('#expense-total').textContent = formatCurrency(expense);
  $('#balance-total').textContent = formatCurrency(income - expense);
  $('#fixed-total').textContent = formatCurrency(fixed);
  $('#variable-total').textContent = formatCurrency(variable);
  $('#budget-rate').textContent = budgetTotal ? `${Math.round((expense / budgetTotal) * 100)}%` : '예산 미설정';
  $('#transaction-count').textContent = `${state.transactions.length}건`;

  renderFormOptions();
  renderTransactions();
  renderBudgets(expenses, monthStart);
  renderMembers(expenses);
  renderBenchmarks(expenses);
  renderRecurring();
  renderFamily();
}

function renderFormOptions() {
  $('#payer').innerHTML = memberOptions(state.currentMember?.id);
  document.querySelectorAll('.member-select').forEach((select) => { select.innerHTML = memberOptions(state.currentMember?.id); });
  updateCategoryOptions();
  $('#budget-category').innerHTML = EXPENSE_CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join('');
  document.querySelectorAll('.expense-category-select').forEach((select) => { select.innerHTML = EXPENSE_CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join(''); });
}

function updateCategoryOptions() {
  const type = new FormData($('#transaction-form')).get('type');
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const current = $('#category').value;
  $('#category').innerHTML = categories.map((category) => `<option value="${category}">${category}</option>`).join('');
  if (categories.includes(current)) $('#category').value = current;
}

function renderTransactions() {
  if (!state.transactions.length) {
    $('#transaction-list').innerHTML = '<div class="empty-state"><span>✦</span><p>아직 기록이 없어요.</p><small>금액과 부담자만 입력해 첫 내역을 추가해 보세요.</small></div>';
    return;
  }
  $('#transaction-list').innerHTML = state.transactions.map((transaction) => `
    <div class="transaction-row">
      <div class="transaction-icon ${transaction.type}">${transaction.type === 'income' ? '↗' : '↘'}</div>
      <div class="transaction-info"><strong>${escapeHtml(transaction.memo || transaction.category)}</strong><span>${escapeHtml(transaction.category)} · ${formatDate(transaction.transaction_date)} · ${escapeHtml(memberName(transaction.payer_member_id))}</span></div>
      <div class="transaction-amount ${transaction.type}"><strong>${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}</strong><span class="transaction-status ${transaction.status}">${transaction.status === 'scheduled' ? '예정' : ''}</span><div class="row-actions"><button type="button" class="delete-button" data-action="edit" data-id="${transaction.id}">수정</button><button type="button" class="delete-button" data-action="delete" data-id="${transaction.id}">삭제</button></div></div>
    </div>
  `).join('');
}

function renderBudgets(expenses, monthStart) {
  const rows = [...new Set([...EXPENSE_CATEGORIES, ...state.budgets.map((item) => item.category)])].map((category) => {
    const spent = sum(expenses.filter((item) => item.category === category), 'amount');
    const budget = sum(state.budgets.filter((item) => item.category === category), 'amount');
    return { category, spent, budget };
  }).filter((row) => row.budget || row.spent);
  $('#budget-list').innerHTML = rows.length ? rows.map((row) => {
    const rate = row.budget ? Math.round((row.spent / row.budget) * 100) : 0;
    const level = rate >= 120 ? 'danger' : rate >= 100 ? 'warning' : rate >= 70 ? 'notice' : '';
    return `<div class="metric-row"><div><strong>${escapeHtml(row.category)}</strong><span>${formatCurrency(row.spent)} / ${row.budget ? formatCurrency(row.budget) : '미설정'}</span></div><div class="metric-value ${level}">${row.budget ? `${rate}%` : '—'}</div></div><div class="progress-track"><span class="progress-bar ${level}" style="width:${Math.min(rate, 100)}%"></span></div>`;
  }).join('') : '<p class="empty-inline">이번 기간에 기록된 지출이 없습니다.</p>';
  $('#budget-form').dataset.month = monthStart;
}

function renderMembers(expenses) {
  const rows = state.members.map((member) => ({ member, amount: sum(expenses.filter((item) => item.payer_member_id === member.id), 'amount') })).sort((a, b) => b.amount - a.amount);
  $('#member-list').innerHTML = rows.length ? rows.map(({ member, amount }) => `<div class="metric-row"><div><strong>${escapeHtml(member.display_name)}</strong><span>${relationshipLabel(member.relationship)}</span></div><div class="metric-value">${formatCurrency(amount)}</div></div>`).join('') : '<p class="empty-inline">구성원이 없습니다.</p>';
}

function renderBenchmarks(expenses) {
  const latest = new Map();
  state.benchmarks.forEach((item) => { if (!latest.has(item.category)) latest.set(item.category, item); });
  const rows = [...categoryTotals(expenses).entries()].map(([category, total]) => {
    const benchmark = latest.get(category);
    if (!benchmark) return null;
    const monthlySpent = total / periodMonths();
    const rate = benchmark.average_amount ? Math.round((monthlySpent / benchmark.average_amount) * 100) : 0;
    return { category, rate, source: benchmark.source_name };
  }).filter(Boolean).sort((a, b) => b.rate - a.rate).slice(0, 5);
  $('#benchmark-list').innerHTML = rows.length ? rows.map((row) => `<div class="metric-row"><div><strong>${escapeHtml(row.category)}</strong><span>${escapeHtml(row.source)}</span></div><div class="metric-value ${row.rate >= 120 ? 'danger' : row.rate > 100 ? 'warning' : ''}">${row.rate}%</div></div>`).join('') : '<p class="empty-inline">아직 공식 기준 데이터가 등록되지 않았습니다.</p>';
}

function renderRecurring() {
  $('#recurring-list').innerHTML = state.recurringTemplates.length ? state.recurringTemplates.map((template) => `<div class="metric-row"><div><strong>${escapeHtml(template.memo || template.category)}</strong><span>매월 ${template.day_of_month}일 · ${escapeHtml(memberName(template.payer_member_id))}</span></div><div class="metric-value">${formatCurrency(template.amount)}</div></div>`).join('') : '<p class="empty-inline">등록된 반복비가 없습니다.</p>';
}

function renderFamily() {
  $('#join-code').textContent = state.household.join_code;
  $('#family-list').innerHTML = state.members.map((member) => `<span class="family-chip">${escapeHtml(member.display_name)} · ${relationshipLabel(member.relationship)}</span>`).join('');
}

function memberOptions(selectedId) {
  return state.members.map((member) => `<option value="${member.id}" ${member.id === selectedId ? 'selected' : ''}>${escapeHtml(member.display_name)} · ${relationshipLabel(member.relationship)}</option>`).join('');
}

function memberName(memberId) { return state.members.find((member) => member.id === memberId)?.display_name || '가족'; }
function categoryTotals(expenses) { return expenses.reduce((totals, item) => totals.set(item.category, (totals.get(item.category) || 0) + Number(item.amount)), new Map()); }

function getPeriodRange() {
  const [year, month] = state.periodDate.split('-').map(Number);
  let startMonth = month - 1;
  let months = 1;
  if (state.periodType === 'quarter') { startMonth = Math.floor(startMonth / 3) * 3; months = 3; }
  if (state.periodType === 'half') { startMonth = startMonth < 6 ? 0 : 6; months = 6; }
  if (state.periodType === 'year') { startMonth = 0; months = 12; }
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + months, 0);
  return { start: toDateString(startDate), end: toDateString(endDate), monthStart: toDateString(startDate) };
}

function periodLabel() {
  const [year, month] = state.periodDate.split('-').map(Number);
  if (state.periodType === 'month') return `${year}년 ${month}월`;
  if (state.periodType === 'quarter') return `${year}년 ${Math.floor((month - 1) / 3) + 1}분기`;
  if (state.periodType === 'half') return `${year}년 ${month <= 6 ? '상반기' : '하반기'}`;
  return `${year}년`;
}

function periodMonths() { return { month: 1, quarter: 3, half: 6, year: 12 }[state.periodType]; }

function nextDueDate(day) {
  const now = new Date();
  let due = new Date(now.getFullYear(), now.getMonth(), day);
  if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) due = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return toDateString(due);
}

function showOnly(id) { ['auth-view', 'onboarding-view', 'config-view', 'app-view'].forEach((viewId) => { document.getElementById(viewId).hidden = viewId !== id; }); }

function showToast(message, type = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => { toast.className = 'toast'; }, 3600);
}

function handleError(error) { console.error(error); showToast(error?.message || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error'); }
function setBusy(button, busy, label) { if (!button) return; button.disabled = busy; button.textContent = label; }
function sum(items, key) { return items.reduce((total, item) => total + Number(item[key] || 0), 0); }
function todayDate() { return toDateString(new Date()); }
function todayMonth() { return todayDate().slice(0, 7); }
function toDateString(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatCurrency(value) { return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value); }
function formatDate(value) { return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`)); }
function relationshipLabel(value) { return { husband: '남편', wife: '아내', daughter: '딸' }[value] || value; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character])); }
