/**
 * SpendWise — Standalone JavaScript Engine
 * script.js · Single data management & SPA controller
 *
 * Responsibilities:
 *  • SPA routing (view switching, nav highlighting)
 *  • State management (in-memory transaction array)
 *  • localStorage persistence layer
 *  • DOM rendering (all list & analytics views)
 *  • Real-time financial calculations
 *  • Live filtering on ledger page
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'spendwise_transactions_v3';

/** Category → emoji map */
const CATEGORY_EMOJI = {
  Salary:        '💼',
  Food:          '🍜',
  Rent:          '🏠',
  Entertainment: '🎬',
  Transport:     '🚌',
  Health:        '⚕️',
  Shopping:      '🛍️',
  Other:         '📦',
};

/** Format a number as USD currency string */
const formatCurrency = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Math.abs(n));

/** Return a human-readable date label */
const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

/** Generate a unique-enough ID */
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Toggle element visibility via the .hidden class */
const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');

/* ═══════════════════════════════════════════════════════════════
   SEED / MOCK DATA
═══════════════════════════════════════════════════════════════ */

const SEED_TRANSACTIONS = [
  { id: 'seed1', text: 'Monthly Tech Stipend',          amount: 85000, type: 'income',  category: 'Salary',        date: new Date(Date.now() - 6 * 86400000).toISOString() },
  { id: 'seed2', text: 'Apartment Rent – October',      amount: 22000, type: 'expense', category: 'Rent',          date: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 'seed3', text: 'Weekly Grocery Run',            amount: 3200,  type: 'expense', category: 'Food',          date: new Date(Date.now() - 4 * 86400000).toISOString() },
  { id: 'seed4', text: 'Freelance Design Project',      amount: 18000, type: 'income',  category: 'Other',         date: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 'seed5', text: 'Netflix + Hotstar Bundle',      amount: 649,   type: 'expense', category: 'Entertainment', date: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 'seed6', text: 'Ola & Auto Rides – This Week',  amount: 1450,  type: 'expense', category: 'Transport',     date: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'seed7', text: 'Gym Membership & Supplements',  amount: 2500,  type: 'expense', category: 'Health',        date: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'seed8', text: 'Myntra & Amazon Shopping',      amount: 4800,  type: 'expense', category: 'Shopping',      date: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 'seed9', text: 'Salary Bonus – Q3 Reward',      amount: 15000, type: 'income',  category: 'Salary',        date: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 'seedA', text: 'Dinner at Social Restaurant',   amount: 1850,  type: 'expense', category: 'Food',          date: new Date().toISOString() },
];

/* ═══════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════ */

let transactions = [];

/* ═══════════════════════════════════════════════════════════════
   PERSISTENCE — localStorage
═══════════════════════════════════════════════════════════════ */

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    console.warn('SpendWise: localStorage write failed.', e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        transactions = parsed;
        return;
      }
    }
  } catch (e) {
    console.warn('SpendWise: localStorage read failed. Seeding defaults.', e);
  }
  // If nothing stored (first run), load seed data
  transactions = [...SEED_TRANSACTIONS];
  saveToStorage();
}

/* ═══════════════════════════════════════════════════════════════
   FINANCIAL CALCULATIONS
═══════════════════════════════════════════════════════════════ */

function calcTotals(list = transactions) {
  let income = 0;
  let expense = 0;
  for (const tx of list) {
    if (tx.type === 'income')  income  += tx.amount;
    else                        expense += tx.amount;
  }
  return { income, expense, balance: income - expense };
}

/** Aggregate totals by category for a given type */
function calcByCategory(type, list = transactions) {
  const map = {};
  for (const tx of list) {
    if (tx.type !== type) continue;
    map[tx.category] = (map[tx.category] || 0) + tx.amount;
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

/* ═══════════════════════════════════════════════════════════════
   DOM ELEMENT CACHE
═══════════════════════════════════════════════════════════════ */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const DOM = {
  // Nav
  navBtns:       () => $$('.nav-btn'),
  views:         () => $$('.page-view'),
  // Dashboard
  statBalance:   () => $('#stat-balance'),
  statIncome:    () => $('#stat-income'),
  statExpense:   () => $('#stat-expense'),
  statTrend:     () => $('#stat-balance-trend'),
  recentList:    () => $('#recent-list'),
  recentEmpty:   () => $('#recent-empty'),
  // Form
  form:          () => $('#transaction-form'),
  txDesc:        () => $('#tx-desc'),
  txAmount:      () => $('#tx-amount'),
  txType:        () => $('#tx-type'),
  txCategory:    () => $('#tx-category'),
  formError:     () => $('#form-error'),
  // Ledger
  ledgerList:    () => $('#ledger-list'),
  ledgerEmpty:   () => $('#ledger-empty'),
  filterSearch:  () => $('#filter-search'),
  filterCat:     () => $('#filter-category'),
  filterType:    () => $('#filter-type'),
  filterCount:   () => $('#filter-count'),
  // Analytics
  kpiSavings:    () => $('#kpi-savings-rate'),
  kpiLargest:    () => $('#kpi-largest-expense'),
  kpiTopIncome:  () => $('#kpi-top-income'),
  kpiTxCount:    () => $('#kpi-tx-count'),
  expenseBars:   () => $('#expense-bars'),
  expBarsEmpty:  () => $('#expense-bars-empty'),
  incomeBars:    () => $('#income-bars'),
  incBarsEmpty:  () => $('#income-bars-empty'),
  summaryBody:   () => $('#summary-table-body'),
  headerDate:    () => $('#header-date'),
};

/* ═══════════════════════════════════════════════════════════════
   BUILD TRANSACTION ITEM HTML
═══════════════════════════════════════════════════════════════ */

function buildTxItem(tx, showDelete = true) {
  const isIncome = tx.type === 'income';
  const emoji = CATEGORY_EMOJI[tx.category] || '📦';
  const sign  = isIncome ? '+' : '-';
  const amtClass  = isIncome ? 'income-amount'  : 'expense-amount';
  const iconClass = isIncome ? 'income-icon'    : 'expense-icon';

  const li = document.createElement('li');
  li.className = 'tx-item';
  li.dataset.id = tx.id;

  li.innerHTML = `
    <div class="tx-left">
      <div class="tx-icon ${iconClass}" aria-hidden="true">${emoji}</div>
      <div class="tx-info">
        <div class="tx-desc" title="${tx.text}">${tx.text}</div>
        <div class="tx-meta">
          <span class="tx-cat">${tx.category}</span>
          <span class="tx-date">${formatDate(tx.date)}</span>
        </div>
      </div>
    </div>
    <div class="tx-right">
      <span class="tx-amount ${amtClass}">${sign}${formatCurrency(tx.amount)}</span>
      ${showDelete
        ? `<button class="btn-delete" onclick="deleteTransactionItem('${tx.id}')" title="Delete transaction" aria-label="Delete ${tx.text}">✕</button>`
        : ''}
    </div>
  `;
  return li;
}

/* ═══════════════════════════════════════════════════════════════
   RENDER FUNCTIONS
═══════════════════════════════════════════════════════════════ */

/** Render summary stat cards */
function renderStats() {
  const { income, expense, balance } = calcTotals();

  const balEl = DOM.statBalance();
  if (balEl) {
    balEl.textContent = (balance >= 0 ? '' : '-') + formatCurrency(balance);
    balEl.style.color = balance >= 0
      ? 'var(--color-income)'
      : 'var(--color-expense)';
  }

  const incEl = DOM.statIncome();
  if (incEl) incEl.textContent = '+' + formatCurrency(income);

  const expEl = DOM.statExpense();
  if (expEl) expEl.textContent = '-' + formatCurrency(expense);

  const trendEl = DOM.statTrend();
  if (trendEl) {
    if (income > 0) {
      const ratio = ((income - expense) / income * 100).toFixed(1);
      trendEl.textContent = `${ratio}% net margin`;
      trendEl.style.color = balance >= 0
        ? 'var(--color-income)'
        : 'var(--color-expense)';
    } else {
      trendEl.textContent = 'No income recorded';
    }
  }
}

/** Render the 4 most recent transactions on the dashboard */
function renderRecent() {
  const list = DOM.recentList();
  const empty = DOM.recentEmpty();
  if (!list) return;

  list.innerHTML = '';
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  if (recent.length === 0) {
    show(empty);
  } else {
    hide(empty);
    for (const tx of recent) {
      list.appendChild(buildTxItem(tx, true));
    }
  }
}

/** Render full ledger (with optional filter) */
function renderLedger() {
  const list  = DOM.ledgerList();
  const empty = DOM.ledgerEmpty();
  const count = DOM.filterCount();
  if (!list) return;

  const search  = (DOM.filterSearch()?.value  || '').toLowerCase().trim();
  const catVal  = DOM.filterCat()?.value  || '';
  const typeVal = DOM.filterType()?.value || '';

  const filtered = transactions
    .filter(tx => {
      const matchSearch = !search  || tx.text.toLowerCase().includes(search);
      const matchCat    = !catVal  || tx.category === catVal;
      const matchType   = !typeVal || tx.type === typeVal;
      return matchSearch && matchCat && matchType;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  list.innerHTML = '';

  if (filtered.length === 0) {
    show(empty);
  } else {
    hide(empty);
    for (const tx of filtered) {
      list.appendChild(buildTxItem(tx, true));
    }
  }

  if (count) {
    count.textContent = `${filtered.length} ${filtered.length === 1 ? 'record' : 'records'}`;
  }
}

/** Build a single CSS progress bar row */
function buildBarRow(label, amount, maxAmount, type) {
  const pct    = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
  const emoji  = CATEGORY_EMOJI[label] || '📦';
  const fillCls = type === 'expense' ? 'expense-fill' : 'income-fill';
  const valCls  = type === 'expense' ? 'expense-value' : 'income-value';

  const div = document.createElement('div');
  div.className = 'bar-row';
  div.innerHTML = `
    <div class="bar-meta">
      <span class="bar-label">
        <span>${emoji}</span> ${label}
        <span class="bar-pct">${pct.toFixed(1)}%</span>
      </span>
      <span class="bar-value ${valCls}">${formatCurrency(amount)}</span>
    </div>
    <div class="bar-track">
      <div class="bar-fill ${fillCls}" style="width: 0%"
           data-target-width="${pct.toFixed(2)}%"></div>
    </div>
  `;
  return div;
}

/** Render analytics page */
function renderAnalytics() {
  const { income, expense, balance } = calcTotals();

  // KPIs
  const savingsRate = income > 0
    ? ((income - expense) / income * 100).toFixed(1) + '%'
    : '—';
  const kpiSavings = DOM.kpiSavings();
  if (kpiSavings) {
    kpiSavings.textContent = savingsRate;
    kpiSavings.style.color = income > 0 && balance >= 0
      ? 'var(--color-income)'
      : 'var(--color-expense)';
  }

  const expCats  = calcByCategory('expense');
  const incCats  = calcByCategory('income');

  const kpiLargest = DOM.kpiLargest();
  if (kpiLargest) {
    kpiLargest.textContent = expCats.length > 0
      ? `${expCats[0][0]} (${formatCurrency(expCats[0][1])})`
      : '—';
  }

  const kpiTopInc = DOM.kpiTopIncome();
  if (kpiTopInc) {
    kpiTopInc.textContent = incCats.length > 0
      ? `${incCats[0][0]} (${formatCurrency(incCats[0][1])})`
      : '—';
  }

  const kpiCount = DOM.kpiTxCount();
  if (kpiCount) kpiCount.textContent = transactions.length;

  // Expense bars
  const expBarsContainer = DOM.expenseBars();
  const expEmpty         = DOM.expBarsEmpty();
  if (expBarsContainer) {
    expBarsContainer.innerHTML = '';
    if (expCats.length === 0) {
      show(expEmpty);
    } else {
      hide(expEmpty);
      const maxExp = expCats[0][1];
      for (const [cat, amt] of expCats) {
        expBarsContainer.appendChild(buildBarRow(cat, amt, maxExp, 'expense'));
      }
    }
  }

  // Income bars
  const incBarsContainer = DOM.incomeBars();
  const incEmpty         = DOM.incBarsEmpty();
  if (incBarsContainer) {
    incBarsContainer.innerHTML = '';
    if (incCats.length === 0) {
      show(incEmpty);
    } else {
      hide(incEmpty);
      const maxInc = incCats[0][1];
      for (const [cat, amt] of incCats) {
        incBarsContainer.appendChild(buildBarRow(cat, amt, maxInc, 'income'));
      }
    }
  }

  // Animate bar widths after a tick (CSS transition requires initial 0 → target)
  requestAnimationFrame(() => {
    $$('[data-target-width]').forEach(el => {
      el.style.width = el.dataset.targetWidth;
    });
  });

  // Summary table
  renderSummaryTable(expCats, incCats);
}

/** Render summary table on analytics page */
function renderSummaryTable(expCats, incCats) {
  const tbody = DOM.summaryBody();
  if (!tbody) return;

  // Collect all categories
  const allCats = new Set([
    ...expCats.map(([c]) => c),
    ...incCats.map(([c]) => c),
  ]);

  const expMap = Object.fromEntries(expCats);
  const incMap = Object.fromEntries(incCats);

  tbody.innerHTML = '';

  if (allCats.size === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:24px">No data available</td></tr>`;
    return;
  }

  for (const cat of [...allCats].sort()) {
    const inc = incMap[cat] || 0;
    const exp = expMap[cat] || 0;
    const net = inc - exp;
    const netClass = net >= 0 ? 'positive' : 'negative';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span style="margin-right:6px">${CATEGORY_EMOJI[cat] || '📦'}</span>${cat}
      </td>
      <td class="col-income">${inc > 0 ? '+' + formatCurrency(inc) : '—'}</td>
      <td class="col-expense">${exp > 0 ? '-' + formatCurrency(exp) : '—'}</td>
      <td class="col-net ${netClass}">
        ${net >= 0 ? '+' : '-'}${formatCurrency(net)}
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Totals row
  const totInc = incCats.reduce((s, [,v]) => s + v, 0);
  const totExp = expCats.reduce((s, [,v]) => s + v, 0);
  const totNet = totInc - totExp;
  const totNetClass = totNet >= 0 ? 'positive' : 'negative';

  const totalRow = document.createElement('tr');
  totalRow.style.borderTop = '2px solid var(--color-border-light)';
  totalRow.style.fontWeight = '700';
  totalRow.innerHTML = `
    <td style="color:var(--color-text-muted);font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase">TOTAL</td>
    <td class="col-income">+${formatCurrency(totInc)}</td>
    <td class="col-expense">-${formatCurrency(totExp)}</td>
    <td class="col-net ${totNetClass}">${totNet >= 0 ? '+' : '-'}${formatCurrency(totNet)}</td>
  `;
  tbody.appendChild(totalRow);
}

/** Full re-render of all visible data */
function renderAll() {
  renderStats();
  renderRecent();
  renderLedger();
  renderAnalytics();
}

/* ═══════════════════════════════════════════════════════════════
   SPA ROUTING
═══════════════════════════════════════════════════════════════ */

function switchPage(targetId) {
  // Hide all views
  DOM.views().forEach(v => v.classList.add('hidden'));
  // Show target
  const targetEl = document.getElementById(targetId);
  if (targetEl) targetEl.classList.remove('hidden');

  // Update nav active state
  DOM.navBtns().forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === targetId);
  });

  // Re-render page-specific content
  if (targetId === 'page-dashboard') {
    renderStats();
    renderRecent();
  } else if (targetId === 'page-transactions') {
    renderLedger();
  } else if (targetId === 'page-analytics') {
    renderAnalytics();
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═══════════════════════════════════════════════════════════════
   ADD TRANSACTION — FORM HANDLER
═══════════════════════════════════════════════════════════════ */

function showFormError(msg) {
  const el = DOM.formError();
  if (!el) return;
  el.textContent = msg;
  show(el);
  setTimeout(() => hide(el), 4000);
}

function addTransaction(text, amount, type, category) {
  const tx = {
    id: genId(),
    text: text.trim(),
    amount: parseFloat(parseFloat(amount).toFixed(2)),
    type,
    category,
    date: new Date().toISOString(),
  };
  transactions.unshift(tx);
  saveToStorage();
  renderAll();
}

/* ═══════════════════════════════════════════════════════════════
   DELETE TRANSACTION  (global scope — called by inline onclick)
═══════════════════════════════════════════════════════════════ */

window.deleteTransactionItem = function deleteTransactionItem(id) {
  const idx = transactions.findIndex(tx => tx.id === id);
  if (idx === -1) return;

  // Animate out
  const itemEl = document.querySelector(`.tx-item[data-id="${id}"]`);
  if (itemEl) {
    itemEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
    itemEl.style.opacity    = '0';
    itemEl.style.transform  = 'translateX(12px)';
    setTimeout(() => {
      transactions.splice(idx, 1);
      saveToStorage();
      renderAll();
    }, 180);
  } else {
    transactions.splice(idx, 1);
    saveToStorage();
    renderAll();
  }
};

/* ═══════════════════════════════════════════════════════════════
   LIVE FILTERING — LEDGER
═══════════════════════════════════════════════════════════════ */

function bindFilterEvents() {
  ['filter-search', 'filter-category', 'filter-type'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  renderLedger);
    el.addEventListener('change', renderLedger);
  });
}

/* ═══════════════════════════════════════════════════════════════
   HEADER DATE
═══════════════════════════════════════════════════════════════ */

function updateHeaderDate() {
  const el = DOM.headerDate();
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

/* ═══════════════════════════════════════════════════════════════
   BOOTSTRAP / INIT
═══════════════════════════════════════════════════════════════ */

function init() {
  // 1. Load data
  loadFromStorage();

  // 2. Update header date
  updateHeaderDate();

  // 3. Wire nav buttons
  DOM.navBtns().forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (target) switchPage(target);
    });
  });

  // 4. Wire "View full ledger →" link on dashboard
  document.addEventListener('click', (e) => {
    const linkBtn = e.target.closest('.link-btn[data-target]');
    if (linkBtn) switchPage(linkBtn.dataset.target);
  });

  // 5. Wire form submission
  const form = DOM.form();
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const text     = DOM.txDesc()?.value    || '';
      const amount   = parseFloat(DOM.txAmount()?.value || '0');
      const type     = DOM.txType()?.value    || 'expense';
      const category = DOM.txCategory()?.value || 'Other';

      // Validation
      if (!text.trim()) {
        showFormError('⚠ Please enter a transaction description.');
        DOM.txDesc()?.focus();
        return;
      }
      if (isNaN(amount) || amount <= 0) {
        showFormError('⚠ Amount must be a positive number greater than zero.');
        DOM.txAmount()?.focus();
        return;
      }
      if (amount > 999_999_99) {
        showFormError('⚠ Amount exceeds maximum allowed value (₹9,99,99,999).');
        DOM.txAmount()?.focus();
        return;
      }

      // Add
      addTransaction(text, amount, type, category);

      // Reset form
      form.reset();
      DOM.txDesc()?.focus();

      // Brief success flash on submit button
      const submitBtn = form.querySelector('.btn-primary');
      if (submitBtn) {
        const orig = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>✓ Added!</span>';
        submitBtn.style.background = 'linear-gradient(135deg, #059669, #047857)';
        setTimeout(() => {
          submitBtn.innerHTML = orig;
          submitBtn.style.background = '';
        }, 1400);
      }
    });
  }

  // 6. Bind live filters
  bindFilterEvents();

  // 7. Initial render
  renderAll();
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
