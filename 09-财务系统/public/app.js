const state = {
  token: localStorage.getItem('financeToken') || '',
  user: JSON.parse(localStorage.getItem('financeUser') || '{}'),
  summary: null,
  view: 'dashboard'
};

const el = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const money = value => `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = value => fmt.format(Number(value || 0));
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

function toast(message, isError = false) {
  const box = el('toast');
  box.textContent = message;
  box.style.background = isError ? '#b42323' : '#26211c';
  box.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add('hidden'), 2600);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
}

function showApp() {
  el('loginView').classList.add('hidden');
  el('appView').classList.remove('hidden');
  el('userLabel').textContent = `${state.user.name || state.user.username || '管理员'} 已登录`;
}

function showLogin() {
  el('appView').classList.add('hidden');
  el('loginView').classList.remove('hidden');
}

async function login(event) {
  event.preventDefault();
  try {
    const data = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: el('username').value.trim(), password: el('password').value })
    }).then(async res => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '登录失败');
      return body;
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('financeToken', state.token);
    localStorage.setItem('financeUser', JSON.stringify(state.user));
    showApp();
    await loadAll();
  } catch (error) {
    toast(error.message, true);
  }
}

function logout() {
  state.token = '';
  state.user = {};
  localStorage.removeItem('financeToken');
  localStorage.removeItem('financeUser');
  showLogin();
}

async function loadAll() {
  const month = el('monthPicker').value || currentMonth();
  try {
    const [summary, incomes, expenses, accounts] = await Promise.all([
      api(`/api/summary?month=${month}`),
      api(`/api/incomes?month=${month}`),
      api(`/api/expenses?month=${month}`),
      api('/api/accounts')
    ]);
    state.summary = summary;
    renderSummary(summary);
    renderRecords(incomes, expenses);
    renderAccounts(accounts);
  } catch (error) {
    if (error.message.includes('登录')) logout();
    toast(error.message, true);
  }
}

function renderAccounts(accounts) {
  el('accountList').innerHTML = accounts.map(item => `<option value="${escapeHtml(item.name)}"></option>`).join('');
}

function renderSummary(data) {
  const c = data.current;
  el('metrics').innerHTML = [
    metric('本月收入', money(c.income), `同比 ${signed(data.compare.incomeYoy)} / 环比 ${signed(data.compare.incomeMom)}`),
    metric('本月支出', money(c.expense), `含电商成本 ${money(Math.max(0, c.expense - (data.expenseBreakdown || []).reduce((s, x) => s + Number(x.value || 0), 0)))}`),
    metric('本月利润', money(c.profit), `环比 ${signed(data.compare.profitMom)}`),
    metric('新增学员', `${num(c.newMembers)} 人`, `活跃 ${num(c.activeMembers)} 人 / 课次 ${num(c.consumedSessions)}`)
  ].join('');
  el('trendChart').innerHTML = lineChart(data.trends);
  el('incomeBars').innerHTML = bars(data.incomeBreakdown);
  el('expenseBars').innerHTML = bars(data.expenseBreakdown);
  el('courseTypeBars').innerHTML = bars(data.courseType);
  el('quickList').innerHTML = [
    quick('累计学员', `${num(data.totalMembers)} 人`),
    quick('有效课程', `${num(data.activeCourseCount)} 门`),
    quick('电商订单', `${num(c.commerceOrders)} 单`),
    quick('待付款支出', money(data.unpaidExpense))
  ].join('');
  el('deltaList').innerHTML = [
    delta('收入同比', data.compare.incomeYoy),
    delta('收入环比', data.compare.incomeMom),
    delta('利润环比', data.compare.profitMom),
    delta('课次活跃环比', data.compare.activityMom)
  ].join('');
  renderTable('studentSpendTable', data.topStudents, row => `<tr><td>${safe(row.name)}</td><td>${safe(row.phone)}</td><td class="money">${money(row.spend)}</td><td>${num(row.orders)}</td></tr>`, 4);
  renderTable('learningTable', data.learningRank, row => `<tr><td>${safe(row.name)}</td><td>${safe(row.phone)}</td><td>${num(row.sessions)}</td><td>${num(row.checkins)}</td><td>${safe(row.lastDate)}</td></tr>`, 5);
  renderTable('courseRankTable', data.courseRank, row => `<tr><td>${safe(row.name)}</td><td>${safe(row.type || '未分类')}</td><td class="money">${money(row.revenue)}</td><td>${num(row.orders)}</td><td>${num(row.students)}</td></tr>`, 5);
  renderTable('activityTable', data.activityByStudent, row => `<tr><td>${safe(row.name)}</td><td>${safe(row.phone)}</td><td>${num(row.checkins)}</td><td>${num(row.sessions)}</td><td>${num(row.weeklyFrequency)} 次/周</td></tr>`, 5);
  el('memberGrowthChart').innerHTML = columnChart(data.memberGrowth);
}

function metric(label, value, foot) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong><em>${foot}</em></article>`;
}

function quick(label, value) {
  return `<div class="quick-item"><span>${label}</span><strong>${value}</strong></div>`;
}

function delta(label, value) {
  const cls = value > 0 ? 'up' : value < 0 ? 'down' : '';
  return `<div class="delta-item"><span>${label}</span><strong class="${cls}">${signed(value)}</strong></div>`;
}

function signed(value) {
  const n = Number(value || 0);
  return `${n > 0 ? '+' : ''}${n}%`;
}

function bars(items) {
  const rows = (items || []).filter(item => Number(item.value) > 0);
  if (!rows.length) return '<div class="empty">暂无数据</div>';
  const max = Math.max(...rows.map(item => Number(item.value || 0)), 1);
  return rows.map(item => `
    <div class="bar-row">
      <div class="bar-top"><b>${safe(item.label || item.category)}</b><span>${money(item.value)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, Number(item.value || 0) / max * 100)}%"></div></div>
    </div>
  `).join('');
}

function lineChart(rows) {
  const width = 760;
  const height = 260;
  const pad = { l: 46, r: 16, t: 16, b: 32 };
  const max = Math.max(...rows.flatMap(r => [r.income, r.expense, Math.max(0, r.profit)]), 1);
  const x = i => pad.l + i * ((width - pad.l - pad.r) / Math.max(rows.length - 1, 1));
  const y = v => height - pad.b - (Number(v || 0) / max) * (height - pad.t - pad.b);
  const path = key => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(key === 'profit' ? Math.max(0, r[key]) : r[key]).toFixed(1)}`).join(' ');
  const labels = rows.map((r, i) => i % 2 === 0 || i === rows.length - 1 ? `<text class="chart-label" x="${x(i)}" y="250" text-anchor="middle">${r.month.slice(5)}</text>` : '').join('');
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <line class="axis" x1="${pad.l}" y1="${height - pad.b}" x2="${width - pad.r}" y2="${height - pad.b}"></line>
    <line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}"></line>
    <path class="line-income" d="${path('income')}"></path>
    <path class="line-expense" d="${path('expense')}"></path>
    <path class="line-profit" d="${path('profit')}"></path>
    ${labels}
    <text class="chart-label" x="58" y="22">收入</text><text class="chart-label" x="102" y="22">支出</text><text class="chart-label" x="146" y="22">利润</text>
  </svg>`;
}

function columnChart(rows) {
  const width = 660;
  const height = 210;
  const pad = { l: 34, r: 12, t: 16, b: 30 };
  const max = Math.max(...(rows || []).map(r => Number(r.count || 0)), 1);
  const bw = (width - pad.l - pad.r) / Math.max(rows.length, 1) - 8;
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <line class="axis" x1="${pad.l}" y1="${height - pad.b}" x2="${width - pad.r}" y2="${height - pad.b}"></line>
    ${(rows || []).map((r, i) => {
      const x = pad.l + i * ((width - pad.l - pad.r) / Math.max(rows.length, 1)) + 4;
      const h = Number(r.count || 0) / max * (height - pad.t - pad.b);
      return `<rect x="${x}" y="${height - pad.b - h}" width="${Math.max(8, bw)}" height="${h}" rx="3" fill="#8b1a1a"></rect><text class="chart-label" x="${x + bw / 2}" y="198" text-anchor="middle">${String(r.month || '').slice(5)}</text>`;
    }).join('')}
  </svg>`;
}

function renderRecords(incomes, expenses) {
  renderTable('incomeTable', incomes, row => `
    <tr><td>${safe(row.incomeDate)}</td><td>${safe(row.category)}</td><td class="money">${money(row.amount)}</td><td>${safe(row.payer)}</td><td>${safe(row.handler)}</td><td><button class="row-action" data-delete="incomes:${row.id}">删除</button></td></tr>
  `, 6);
  renderTable('expenseTable', expenses, row => `
    <tr><td>${safe(row.expenseDate)}</td><td>${safe(row.category)}</td><td class="money">${money(row.amount)}</td><td>${safe(row.payee)}</td><td>${safe(row.paidStatus)}</td><td><button class="row-action" data-delete="expenses:${row.id}">删除</button></td></tr>
  `, 6);
}

function renderTable(id, rows, renderRow, span) {
  el(id).innerHTML = rows && rows.length ? rows.map(renderRow).join('') : `<tr><td class="empty" colspan="${span}">暂无数据</td></tr>`;
}

function openDialog(type) {
  el('recordType').value = type;
  el('dialogTitle').textContent = type === 'expenses' ? '登记支出' : '登记收入';
  el('counterpartyLabel').firstChild.textContent = type === 'expenses' ? '收款方' : '付款方';
  el('paidStatusLabel').classList.toggle('hidden', type !== 'expenses');
  el('recordDate').value = today();
  el('recordCategory').value = type === 'expenses' ? '日常运营' : '其他收入';
  el('recordAmount').value = '';
  el('recordAccount').value = '微信';
  el('recordCounterparty').value = '';
  el('recordHandler').value = state.user.name || '';
  el('recordRemark').value = '';
  el('recordDialog').showModal();
}

async function saveRecord(event) {
  event.preventDefault();
  const type = el('recordType').value;
  const body = {
    date: el('recordDate').value,
    category: el('recordCategory').value,
    amount: el('recordAmount').value,
    account: el('recordAccount').value,
    handler: el('recordHandler').value,
    remark: el('recordRemark').value,
    paidStatus: el('recordPaidStatus').value
  };
  if (type === 'expenses') body.payee = el('recordCounterparty').value;
  else body.payer = el('recordCounterparty').value;
  try {
    await api(`/api/${type}`, { method: 'POST', body: JSON.stringify(body) });
    el('recordDialog').close();
    toast('已保存');
    await loadAll();
  } catch (error) {
    toast(error.message, true);
  }
}

async function deleteRecord(target) {
  const value = target.dataset.delete;
  if (!value) return;
  const [type, id] = value.split(':');
  if (!confirm('确认删除这条记录？')) return;
  try {
    await api(`/api/${type}/${id}`, { method: 'DELETE' });
    toast('已删除');
    await loadAll();
  } catch (error) {
    toast(error.message, true);
  }
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll('.nav').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  document.querySelectorAll('.view').forEach(section => section.classList.add('hidden'));
  el(`${view}View`).classList.remove('hidden');
  const titles = {
    dashboard: ['总览', '月度收入、支出、利润与经营变化'],
    finance: ['收支', '公司其他收入与支出登记'],
    students: ['学员', '增长、消费排名、学习频率和积极性'],
    courses: ['课程', '课程收入、类型结构和学员购买情况']
  };
  el('pageTitle').textContent = titles[view][0];
  el('pageSubtitle').textContent = titles[view][1];
}

function safe(value) {
  return escapeHtml(value || '');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

document.addEventListener('click', event => {
  const nav = event.target.closest('.nav');
  if (nav) switchView(nav.dataset.view);
  const deleteBtn = event.target.closest('[data-delete]');
  if (deleteBtn) deleteRecord(deleteBtn);
});

el('loginForm').addEventListener('submit', login);
el('logoutBtn').addEventListener('click', logout);

// 系统切换菜单
function toggleSystemMenu() {
  const menu = document.getElementById('systemSwitchMenu');
  if (!menu) return;
  const isOpen = menu.classList.contains('show');
  document.querySelectorAll('.system-switch-menu').forEach(m => m.classList.remove('show'));
  if (!isOpen) menu.classList.add('show');
}

// 点击其他地方关闭系统菜单
document.addEventListener('click', (e) => {
  if (!e.target.closest('.system-switch')) {
    document.querySelectorAll('.system-switch-menu').forEach(m => m.classList.remove('show'));
  }
});
el('refreshBtn').addEventListener('click', loadAll);
el('monthPicker').addEventListener('change', loadAll);
el('addIncomeBtn').addEventListener('click', () => openDialog('incomes'));
el('addExpenseBtn').addEventListener('click', () => openDialog('expenses'));
el('recordForm').addEventListener('submit', saveRecord);
el('closeDialog').addEventListener('click', () => el('recordDialog').close());
el('cancelDialog').addEventListener('click', () => el('recordDialog').close());

el('monthPicker').value = currentMonth();
if (state.token) {
  showApp();
  loadAll();
} else {
  showLogin();
}
