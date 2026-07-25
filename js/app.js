/* ============================================================
   EXPENSE & BUDGET VISUALIZER — app.js
   Features:
   - Add / delete transactions (income & expense)
   - Canvas pie chart for spending by category
   - Custom categories (add & remove)
   - Monthly summary view
   - Sort by amount or date; filter by type / category
   - Highlight spending over set monthly limit
   - Dark / Light mode toggle
   - All data persisted in localStorage
   ============================================================ */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Salary', 'Other'];

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// Palette for pie chart slices
const CHART_COLORS = [
  '#4caf50','#2196f3','#ff9800','#e91e63','#9c27b0',
  '#00bcd4','#ff5722','#607d8b','#8bc34a','#ffc107',
  '#3f51b5','#009688',
];

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  transactions: [],   // { id, desc, amount, type, category, date }
  categories: [],     // string[]
  spendingLimit: 0,   // number
  theme: 'light',     // 'light' | 'dark'
};

// ─── LocalStorage ─────────────────────────────────────────────────────────────

function saveState() {
  localStorage.setItem('ft_transactions', JSON.stringify(state.transactions));
  localStorage.setItem('ft_categories',   JSON.stringify(state.categories));
  localStorage.setItem('ft_limit',        String(state.spendingLimit));
  localStorage.setItem('ft_theme',        state.theme);
}

function loadState() {
  try {
    const tx  = localStorage.getItem('ft_transactions');
    const cat = localStorage.getItem('ft_categories');
    const lim = localStorage.getItem('ft_limit');
    const thm = localStorage.getItem('ft_theme');
    state.transactions  = tx  ? JSON.parse(tx)  : [];
    state.categories    = cat ? JSON.parse(cat) : [...DEFAULT_CATEGORIES];
    state.spendingLimit = lim ? parseFloat(lim) : 0;
    state.theme         = thm || 'light';
  } catch {
    state.categories = [...DEFAULT_CATEGORIES];
  }
}

// ─── DOM Refs ─────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const dom = {
  btnTheme: $('btnTheme'), themeIcon: $('themeIcon'),
  totalBalance: $('totalBalance'), totalIncome: $('totalIncome'), totalExpense: $('totalExpense'),
  spendingLimit: $('spendingLimit'), btnSetLimit: $('btnSetLimit'), limitStatus: $('limitStatus'),
  txForm: $('transactionForm'),
  txDesc: $('txDesc'), txAmount: $('txAmount'), txType: $('txType'),
  txCategory: $('txCategory'), txDate: $('txDate'), formError: $('formError'),
  filterType: $('filterType'), filterCategory: $('filterCategory'),
  sortBy: $('sortBy'), btnClearAll: $('btnClearAll'),
  txList: $('transactionList'), emptyState: $('emptyState'),
  catToggle: $('catToggle'), catBody: $('catBody'), catChevron: $('catChevron'),
  newCatName: $('newCatName'), btnAddCategory: $('btnAddCategory'),
  catError: $('catError'), categoryList: $('categoryList'),
  summaryToggle: $('summaryToggle'), summaryBody: $('summaryBody'), summaryChevron: $('summaryChevron'),
  summaryYear: $('summaryYear'), monthlyGrid: $('monthlyGrid'),
  pieChart: $('pieChart'), chartLegend: $('chartLegend'),
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function formatRupiah(n) {
  return 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showErr(el, msg) {
  el.textContent = msg;
  setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3000);
}

function currentMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  state.theme = theme;
}

dom.btnTheme.addEventListener('click', () => {
  applyTheme(state.theme === 'light' ? 'dark' : 'light');
  saveState();
});

// ─── Categories ───────────────────────────────────────────────────────────────

function renderCategoryTags() {
  dom.categoryList.innerHTML = '';
  state.categories.forEach(cat => {
    const isDefault = DEFAULT_CATEGORIES.includes(cat);
    const li = document.createElement('li');
    li.className = 'cat-tag' + (isDefault ? ' is-default' : '');
    li.innerHTML = escHtml(cat) +
      (isDefault
        ? ''
        : `<button class="cat-tag__remove" data-cat="${escHtml(cat)}" aria-label="Remove ${escHtml(cat)}">✕</button>`);
    dom.categoryList.appendChild(li);
  });
}

function populateCategoryDropdowns() {
  const opts = state.categories.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
  dom.txCategory.innerHTML = opts;
  dom.filterCategory.innerHTML =
    `<option value="all">All Categories</option>` +
    state.categories.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
}

function refreshCategories() {
  renderCategoryTags();
  populateCategoryDropdowns();
}

dom.btnAddCategory.addEventListener('click', () => {
  const name = dom.newCatName.value.trim();
  if (!name) return showErr(dom.catError, 'Category name cannot be empty.');
  if (state.categories.some(c => c.toLowerCase() === name.toLowerCase()))
    return showErr(dom.catError, 'Category already exists.');
  state.categories.push(name);
  dom.newCatName.value = '';
  saveState();
  refreshCategories();
});

dom.newCatName.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); dom.btnAddCategory.click(); }
});

dom.categoryList.addEventListener('click', e => {
  const btn = e.target.closest('.cat-tag__remove');
  if (!btn) return;
  const name = btn.dataset.cat;
  if (!confirm(`Remove category "${name}"? Transactions will move to "Other".`)) return;
  state.transactions = state.transactions.map(tx =>
    tx.category === name ? { ...tx, category: 'Other' } : tx
  );
  state.categories = state.categories.filter(c => c !== name);
  saveState();
  refreshCategories();
  renderAll();
});

// ─── Transactions ─────────────────────────────────────────────────────────────

dom.txForm.addEventListener('submit', e => {
  e.preventDefault();
  dom.formError.textContent = '';

  const desc     = dom.txDesc.value.trim();
  const amount   = parseFloat(dom.txAmount.value);
  const type     = dom.txType.value;
  const category = dom.txCategory.value;
  const date     = dom.txDate.value;

  if (!desc)            return showErr(dom.formError, 'Please enter an item name.');
  if (!amount || amount <= 0) return showErr(dom.formError, 'Enter a valid amount greater than 0.');
  if (!date)            return showErr(dom.formError, 'Please select a date.');

  state.transactions.unshift({ id: genId(), desc, amount, type, category, date });
  saveState();
  dom.txForm.reset();
  dom.txDate.value = todayISO();
  renderAll();
});

dom.btnClearAll.addEventListener('click', () => {
  if (!state.transactions.length) return;
  if (!confirm('Delete ALL transactions? This cannot be undone.')) return;
  state.transactions = [];
  saveState();
  renderAll();
});

dom.txList.addEventListener('click', e => {
  const btn = e.target.closest('.tx-item__delete');
  if (!btn) return;
  if (!confirm('Delete this transaction?')) return;
  state.transactions = state.transactions.filter(t => t.id !== btn.dataset.id);
  saveState();
  renderAll();
});

dom.filterType.addEventListener('change',     () => renderTransactions());
dom.filterCategory.addEventListener('change', () => renderTransactions());
dom.sortBy.addEventListener('change',         () => renderTransactions());

function getVisible() {
  const typeF = dom.filterType.value;
  const catF  = dom.filterCategory.value;
  const sort  = dom.sortBy.value;
  let list = [...state.transactions];
  if (typeF !== 'all') list = list.filter(t => t.type === typeF);
  if (catF  !== 'all') list = list.filter(t => t.category === catF);
  switch (sort) {
    case 'date-desc':   list.sort((a,b) => new Date(b.date)-new Date(a.date)); break;
    case 'date-asc':    list.sort((a,b) => new Date(a.date)-new Date(b.date)); break;
    case 'amount-desc': list.sort((a,b) => b.amount-a.amount); break;
    case 'amount-asc':  list.sort((a,b) => a.amount-b.amount); break;
  }
  return list;
}

function renderTransactions() {
  // Remove old items
  dom.txList.querySelectorAll('.tx-item').forEach(el => el.remove());

  const list = getVisible();
  if (!list.length) { dom.emptyState.style.display = ''; return; }
  dom.emptyState.style.display = 'none';

  const { year: cy, month: cm } = currentMonth();

  list.forEach(tx => {
    const li = document.createElement('li');
    li.className = 'tx-item';

    // highlight individual expense over limit in current month
    if (tx.type === 'expense' && state.spendingLimit > 0) {
      const d = new Date(tx.date);
      if (d.getFullYear() === cy && d.getMonth() + 1 === cm && tx.amount > state.spendingLimit) {
        li.classList.add('tx-item--over-limit');
      }
    }

    const sign    = tx.type === 'income' ? '+' : '-';
    const dateStr = new Date(tx.date + 'T00:00:00').toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    li.innerHTML = `
      <div class="tx-item__info">
        <p class="tx-item__name">${escHtml(tx.desc)}</p>
        <p class="tx-item__amount tx-item__amount--${tx.type}">${sign} ${formatRupiah(tx.amount)}</p>
        <span class="tx-item__cat">${escHtml(tx.category)}</span>
        <p class="tx-item__meta">${dateStr}</p>
      </div>
      <button class="tx-item__delete" data-id="${tx.id}" aria-label="Delete transaction">Delete</button>
    `;
    dom.txList.appendChild(li);
  });
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function renderSummaryCards() {
  const income  = state.transactions.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const expense = state.transactions.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  dom.totalBalance.textContent = formatRupiah(income - expense);
  dom.totalIncome.textContent  = 'Income: '   + formatRupiah(income);
  dom.totalExpense.textContent = 'Expenses: ' + formatRupiah(expense);
}

// ─── Spending limit ───────────────────────────────────────────────────────────

dom.btnSetLimit.addEventListener('click', () => {
  const v = parseFloat(dom.spendingLimit.value);
  if (isNaN(v) || v < 0) return showErr(dom.limitStatus, 'Enter a valid positive number.');
  state.spendingLimit = v;
  saveState();
  renderAll();
});

function renderLimitStatus() {
  const { year, month } = currentMonth();
  const spent = state.transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .reduce((s,t) => s+t.amount, 0);

  if (!state.spendingLimit) {
    dom.limitStatus.textContent = '';
    dom.limitStatus.className   = 'limit-status';
    if (state.spendingLimit === 0) dom.spendingLimit.value = '';
    return;
  }

  dom.spendingLimit.value = state.spendingLimit;
  const pct  = (spent / state.spendingLimit) * 100;
  const diff = state.spendingLimit - spent;

  if (pct >= 100) {
    dom.limitStatus.textContent = `🚨 Over limit by ${formatRupiah(Math.abs(diff))}! (${formatRupiah(spent)} / ${formatRupiah(state.spendingLimit)})`;
    dom.limitStatus.className   = 'limit-status over';
  } else if (pct >= 80) {
    dom.limitStatus.textContent = `⚠️ ${pct.toFixed(0)}% used — ${formatRupiah(diff)} remaining`;
    dom.limitStatus.className   = 'limit-status warn';
  } else {
    dom.limitStatus.textContent = `✅ ${pct.toFixed(0)}% used — ${formatRupiah(diff)} remaining`;
    dom.limitStatus.className   = 'limit-status safe';
  }
}

// ─── Pie chart (vanilla canvas) ───────────────────────────────────────────────

function renderPieChart() {
  const canvas = dom.pieChart;
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Aggregate expenses by category
  const totals = {};
  state.transactions
    .filter(t => t.type === 'expense')
    .forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const entries = Object.entries(totals).filter(([,v]) => v > 0);

  // Legend (always render)
  dom.chartLegend.innerHTML = '';

  if (!entries.length) {
    // empty state: draw grey circle
    ctx.beginPath();
    ctx.arc(W/2, H/2, Math.min(W,H)/2 - 4, 0, Math.PI*2);
    ctx.fillStyle = '#e0e0e0';
    ctx.fill();

    const li = document.createElement('li');
    li.className = 'legend-item';
    li.style.color = 'var(--text-muted)';
    li.textContent = 'No expense data yet';
    dom.chartLegend.appendChild(li);
    return;
  }

  const total = entries.reduce((s,[,v]) => s+v, 0);
  const cx = W/2, cy = H/2, r = Math.min(W,H)/2 - 4;
  let startAngle = -Math.PI / 2;   // start from top

  entries.forEach(([cat, val], i) => {
    const color      = CHART_COLORS[i % CHART_COLORS.length];
    const sliceAngle = (val / total) * Math.PI * 2;

    // Draw slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle += sliceAngle;

    // Legend item
    const li = document.createElement('li');
    li.className = 'legend-item';
    li.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      ${escHtml(cat)}
    `;
    dom.chartLegend.appendChild(li);
  });
}

// ─── Monthly summary ──────────────────────────────────────────────────────────

function populateYearSelect() {
  const years = new Set(state.transactions.map(t => new Date(t.date).getFullYear()));
  years.add(new Date().getFullYear());
  const sorted = [...years].sort((a,b) => b-a);
  const cur = dom.summaryYear.value;
  dom.summaryYear.innerHTML = sorted.map(y => `<option value="${y}">${y}</option>`).join('');
  if (cur && sorted.includes(+cur)) dom.summaryYear.value = cur;
}

function renderMonthlySummary() {
  const year = parseInt(dom.summaryYear.value, 10);
  dom.monthlyGrid.innerHTML = '';
  for (let m = 1; m <= 12; m++) {
    const txs = state.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() + 1 === m;
    });
    if (!txs.length) continue;
    const inc = txs.filter(t => t.type === 'income').reduce((s,t)=>s+t.amount,0);
    const exp = txs.filter(t => t.type === 'expense').reduce((s,t)=>s+t.amount,0);
    const net = inc - exp;
    const card = document.createElement('div');
    card.className = 'month-card';
    card.innerHTML = `
      <p class="month-card__name">${MONTHS[m-1]}</p>
      <div class="month-card__row"><span>Income</span><span class="c-income">${formatRupiah(inc)}</span></div>
      <div class="month-card__row"><span>Expense</span><span class="c-expense">${formatRupiah(exp)}</span></div>
      <div class="month-card__row"><span>Net</span><span class="${net>=0?'c-positive':'c-negative'}">${net>=0?'+':'-'} ${formatRupiah(net)}</span></div>
    `;
    dom.monthlyGrid.appendChild(card);
  }
  if (!dom.monthlyGrid.children.length) {
    dom.monthlyGrid.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem">No data for ${year}.</p>`;
  }
}

dom.summaryYear.addEventListener('change', renderMonthlySummary);

// ─── Collapsible panels ───────────────────────────────────────────────────────

function setupCollapsible(toggleBtn, bodyEl, chevronEl, onOpen) {
  toggleBtn.addEventListener('click', () => {
    const opening = bodyEl.classList.contains('hidden');
    bodyEl.classList.toggle('hidden', !opening);
    chevronEl.classList.toggle('open', opening);
    toggleBtn.setAttribute('aria-expanded', String(opening));
    if (opening && onOpen) onOpen();
  });
  toggleBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBtn.click(); }
  });
}

setupCollapsible(dom.catToggle, dom.catBody, dom.catChevron);
setupCollapsible(dom.summaryToggle, dom.summaryBody, dom.summaryChevron, () => {
  populateYearSelect();
  renderMonthlySummary();
});

// ─── Full render ──────────────────────────────────────────────────────────────

function renderAll() {
  renderSummaryCards();
  renderLimitStatus();
  renderTransactions();
  renderPieChart();
  populateYearSelect();
  if (!dom.summaryBody.classList.contains('hidden')) renderMonthlySummary();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  loadState();
  applyTheme(state.theme);
  dom.txDate.value = todayISO();
  refreshCategories();
  renderAll();
}

init();
