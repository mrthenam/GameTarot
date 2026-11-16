// Admin page (admin.html): prizes with win rates and quantities, voucher codes, shop settings.
// Talks to the prize API in server/api.mjs.
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import './admin.css';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
interface Prize {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rarity: Rarity;
  rate: number;
  quantity: number | null;
  dailyLimit: number | null;
  won: number;
  wonToday?: number;
  voucher: boolean;
  extraTurns: number;
  active: boolean;
  fallback: boolean;
}
interface Settings {
  gameTitle: string;
  subtitle: string;
  shopName: string;
  turnsPerDay: number;
  pityEvery: number;
  voucherDays: number;
  codePrefix: string;
  redeemNote: string;
}
interface AdminState {
  settings: Settings;
  prizes: Prize[];
  stats: { draws: number; drawsToday: number; codes: number; redeemed: number; players: number };
  passwordFromEnv: boolean;
}
interface Draw {
  id: number;
  at: number;
  prizeName: string;
  rarity: Rarity;
  code: string | null;
  expires: number | null;
  redeemedAt: number | null;
  pity: boolean;
  test: boolean;
}

const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: 'Thường', color: '#8fd8ff' },
  rare: { label: 'Hiếm', color: '#b98cff' },
  epic: { label: 'Sử Thi', color: '#ff6fb5' },
  legendary: { label: 'Huyền Thoại', color: '#ffcf5a' },
};
const ICONS: Record<string, string> = {
  star: 'Ngôi sao', hourglass: 'Đồng hồ cát', ticket: 'Vé giảm giá', giftbox: 'Hộp quà', tea: 'Đồ uống',
  envelope: 'Bao lì xì', crown: 'Vương miện', cake: 'Bánh ngọt', crystal: 'Pha lê',
};
const iconModules = import.meta.glob('../assets/icons/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const iconUrl = (n: string) => iconModules[`../assets/icons/${n}.webp`] ?? iconModules['../assets/icons/giftbox.webp'];

const API = `${import.meta.env.BASE_URL}api`;
const TOKEN_KEY = 'tarot-admin-token';
const app = document.getElementById('app')!;

let token = store(TOKEN_KEY);
let state: AdminState | null = null;
let draft: Prize[] = [];
let dirty = false;
let saveError = '';
let tab: 'prizes' | 'codes' | 'settings' = 'prizes';
let draws: Draw[] = [];
let drawQuery = '';

// ---------------------------------------------------------------- helpers
function store(k: string, v?: string | null): string | null {
  try {
    if (v === undefined) return sessionStorage.getItem(k);
    if (v === null) sessionStorage.removeItem(k);
    else sessionStorage.setItem(k, v);
  } catch {
    /* storage blocked: stay logged in for this page only */
  }
  return v ?? null;
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n: number, d = 0) => n.toLocaleString('vi-VN', { maximumFractionDigits: d });
const when = (ms: number) => new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = app) => root.querySelector(sel) as T | null;

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/admin/login') {
    logout(data.error);
    throw new Error(data.error || 'Phiên đăng nhập đã hết hạn.');
  }
  if (!res.ok) throw new Error(data.error || `Máy chủ trả về lỗi ${res.status}.`);
  return data as T;
}

function toast(msg: string) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

function setState(s: AdminState) {
  state = s;
  draft = s.prizes.map((p) => ({ ...p }));
  dirty = false;
  saveError = '';
}

// ---------------------------------------------------------------- login
function renderLogin(err = '') {
  app.innerHTML = `
    <div class="login"><div class="panel">
      <h1>Quản trị quà</h1>
      <p class="muted">Căn Phòng Tarot</p>
      <form id="login">
        <label class="f"><span>Mật khẩu</span><input type="password" name="pw" autocomplete="current-password" required autofocus></label>
        ${err ? `<div class="err">${esc(err)}</div>` : ''}
        <button class="btn primary" type="submit">Đăng nhập</button>
        <p class="hint">Lần chạy đầu, máy chủ tạo sẵn mật khẩu và lưu ở <code>server/data/admin-password.txt</code>.</p>
      </form>
    </div></div>`;
  $('#login')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = (($('input[name=pw]') as HTMLInputElement | null)?.value ?? '').trim();
    try {
      const r = await api<{ token: string }>('POST', '/admin/login', { password: pw });
      token = store(TOKEN_KEY, r.token);
      await boot();
    } catch (ex) {
      renderLogin((ex as Error).message);
    }
  });
}

function logout(msg = '') {
  token = store(TOKEN_KEY, null);
  state = null;
  renderLogin(msg);
}

// ---------------------------------------------------------------- shell
function renderShell() {
  app.innerHTML = `
    <header class="top"><div class="wrap">
      <div class="brand"><h1>Quản trị quà</h1><span>${esc(state?.settings.shopName || state?.settings.gameTitle)}</span></div>
      <nav class="tabs">
        <button class="tab" data-tab="prizes">Quà &amp; tỉ lệ</button>
        <button class="tab" data-tab="codes">Mã quà</button>
        <button class="tab" data-tab="settings">Cài đặt</button>
      </nav>
      <a class="link" href="./" target="_blank" rel="noopener">Mở game</a>
      <button class="link" data-action="logout">Đăng xuất</button>
    </div></header>
    <main><div class="wrap" id="view"></div></main>
    <div class="savebar" id="savebar"><div class="wrap">
      <div class="msg" id="savemsg"></div>
      <button class="btn" data-action="undo">Hoàn tác</button>
      <button class="btn primary" data-action="save">Lưu thay đổi</button>
    </div></div>`;
  renderTab();
}

function renderTab() {
  app.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === tab));
  const view = $('#view')!;
  if (tab === 'prizes') view.innerHTML = prizesView();
  else if (tab === 'codes') view.innerHTML = codesView();
  else view.innerHTML = settingsView();
  if (tab === 'prizes') updateMeter();
  updateSavebar();
}

// ---------------------------------------------------------------- prizes
function prizesView() {
  const s = state!.stats;
  return `
    <div class="stats">
      <div class="stat"><b>${fmt(s.drawsToday)}</b><span>Lượt bốc hôm nay</span></div>
      <div class="stat"><b>${fmt(s.draws)}</b><span>Tổng lượt bốc</span></div>
      <div class="stat"><b>${fmt(s.codes)}</b><span>Mã quà đã phát</span></div>
      <div class="stat"><b>${fmt(s.redeemed)}</b><span>Mã đã đổi quà</span></div>
    </div>
    <div class="panel meter" id="meter"></div>
    <div class="section-head">
      <h2>Danh sách quà</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn small" data-action="reset-won">Đặt lại số đã trúng</button>
        <button class="btn small" data-action="add">+ Thêm món quà</button>
      </div>
    </div>
    <div class="prizes" id="prizes">${draft.map(prizeCard).join('')}</div>`;
}

function prizeCard(p: Prize, i: number) {
  const icons = Object.entries(ICONS).map(([k, label]) => `<option value="${k}" ${k === p.icon ? 'selected' : ''}>${label}</option>`).join('');
  const rarities = (Object.keys(RARITY) as Rarity[]).map((k) => `<option value="${k}" ${k === p.rarity ? 'selected' : ''}>${RARITY[k].label}</option>`).join('');
  const fb = p.fallback;
  return `
    <article class="prize ${p.rarity} ${p.active ? '' : 'off'}" data-i="${i}">
      <div class="p-head">
        <div class="p-icon"><img src="${iconUrl(p.icon)}" alt=""></div>
        <label class="f p-name"><span>Tên món quà <em class="pid">mã: ${esc(p.id)}</em></span>
          <input type="text" data-k="name" value="${esc(p.name)}" placeholder="VD: Voucher giảm 10%"></label>
        <label class="check" title="Tắt để tạm ngừng phát món này"><input type="checkbox" data-k="active" ${p.active ? 'checked' : ''}> Đang phát</label>
        <button class="icon-btn" data-action="remove" title="Xóa món quà" aria-label="Xóa món quà">✕</button>
      </div>
      <div class="p-grid">
        <label class="f wide"><span>Mô tả cho khách</span><input type="text" data-k="desc" value="${esc(p.desc)}" placeholder="Hiện trên thẻ quà"></label>
        <label class="f"><span>Tỉ lệ trúng (%)</span><input type="number" data-k="rate" min="0" max="100" step="0.01" value="${p.rate}"></label>
        <label class="f"><span>Tổng số giải</span><input type="number" data-k="quantity" min="0" step="1" value="${p.quantity ?? ''}" placeholder="Không giới hạn" ${fb ? 'disabled' : ''}></label>
        <label class="f"><span>Tối đa mỗi ngày</span><input type="number" data-k="dailyLimit" min="1" step="1" value="${p.dailyLimit ?? ''}" placeholder="Không giới hạn" ${fb ? 'disabled' : ''}></label>
        <label class="f"><span>Độ hiếm</span><select data-k="rarity">${rarities}</select></label>
        <label class="f"><span>Biểu tượng</span><select data-k="icon">${icons}</select></label>
        <label class="f"><span>Cộng thêm lượt</span><input type="number" data-k="extraTurns" min="0" max="5" step="1" value="${p.extraTurns}"></label>
        <div class="p-flags">
          <label class="check"><input type="checkbox" data-k="voucher" ${p.voucher ? 'checked' : ''}> Phát mã quà để đổi tại quầy</label>
          <label class="check" title="Nhận phần tỉ lệ còn lại và phần của các món đã hết"><input type="radio" name="fallback" data-k="fallback" ${fb ? 'checked' : ''}> Quà dự phòng</label>
        </div>
      </div>
      <div class="p-foot" id="foot-${i}">${prizeFoot(p)}</div>
    </article>`;
}

function rateSum() {
  return draft.filter((p) => p.active).reduce((s, p) => s + (Number(p.rate) || 0), 0);
}

function prizeFoot(p: Prize) {
  const rest = Math.max(0, 100 - rateSum());
  const per1000 = p.active ? ((Number(p.rate) || 0) + (p.fallback ? rest : 0)) * 10 : 0;
  const tags: string[] = [];
  if (p.fallback) tags.push('<span class="tag gold">Quà dự phòng</span>');
  if (!p.active) tags.push('<span class="tag">Tạm ngừng</span>');
  if (p.quantity !== null && p.won >= p.quantity) tags.push('<span class="tag out">Hết quà</span>');
  else if (p.dailyLimit !== null && (p.wonToday ?? 0) >= p.dailyLimit) tags.push('<span class="tag out">Đủ số hôm nay</span>');
  const left = p.quantity === null ? 'không giới hạn' : `còn <b>${fmt(Math.max(0, p.quantity - p.won))}</b>`;
  const bar = p.quantity ? `<div class="bar"><i style="width:${Math.min(100, (p.won / p.quantity) * 100)}%"></i></div>` : '';
  return `${tags.join(' ')}
    <span>Đã trúng <b>${fmt(p.won)}</b>${p.quantity !== null ? ` / ${fmt(p.quantity)}` : ''} · ${left}</span>
    <span>Hôm nay <b>${fmt(p.wonToday ?? 0)}</b>${p.dailyLimit !== null ? ` / ${fmt(p.dailyLimit)}` : ''}</span>
    ${bar}
    <span title="Số lần trúng dự kiến khi còn quà">≈ <b>${fmt(per1000, 1)}</b> / 1.000 lượt</span>`;
}

function updateMeter() {
  const el = $('#meter');
  if (!el) return;
  const sum = rateSum();
  const fb = draft.find((p) => p.fallback);
  const segs = draft
    .filter((p) => p.active && p.rate > 0)
    .map((p) => `<i style="width:${Math.min(100, p.rate)}%;background:${RARITY[p.rarity].color}" title="${esc(p.name)}: ${fmt(p.rate, 2)}%"></i>`)
    .join('');
  const rest = 100 - sum;
  el.innerHTML = `
    <div class="meter-text">
      <span>Tổng tỉ lệ quà đang phát: <b>${fmt(sum, 2)}%</b></span>
      ${rest < -0.0001
        ? `<span class="bad">Vượt 100%: cần giảm ${fmt(-rest, 2)}%</span>`
        : rest > 0.0001
          ? `<span>Phần còn lại <b>${fmt(rest, 2)}%</b> thuộc về ${fb ? `“${esc(fb.name)}”` : 'quà dự phòng'}</span>`
          : '<span class="good">Đủ 100%</span>'}
    </div>
    <div class="meter-bar">${segs}${rest > 0.0001 ? `<i class="rest" style="width:${rest}%" title="Phần còn lại → quà dự phòng"></i>` : ''}</div>
    <div class="hint">Mỗi lượt bốc, mỗi món có đúng tỉ lệ đặt ở đây. Món đã hết số giải, đã đủ số trong ngày hoặc đang tạm ngừng sẽ nhường phần tỉ lệ của nó cho quà dự phòng. Khi khách đã bốc trúng quà Thường liên tiếp đủ số lần trong Cài đặt, lượt sau chỉ bốc trong các món Hiếm trở lên còn quà.</div>`;
  draft.forEach((p, i) => {
    const f = $(`#foot-${i}`);
    if (f) f.innerHTML = prizeFoot(p);
  });
}

function markDirty() {
  dirty = true;
  saveError = '';
  updateSavebar();
}

function updateSavebar() {
  const bar = $('#savebar');
  if (!bar) return;
  const show = tab === 'prizes' && dirty;
  bar.classList.toggle('on', show);
  const over = rateSum() > 100.0001;
  const msg = $('#savemsg')!;
  msg.innerHTML = saveError ? `<span class="err">${esc(saveError)}</span>` : over ? '<span style="color:var(--danger)">Tổng tỉ lệ đang vượt 100%</span>' : 'Có thay đổi chưa lưu';
  ($('[data-action=save]') as HTMLButtonElement).disabled = over;
}

function newId() {
  const used = new Set(draft.map((p) => p.id));
  let id = '';
  do id = `qua-${Math.random().toString(36).slice(2, 6)}`;
  while (used.has(id));
  return id;
}

// ---------------------------------------------------------------- codes
function codesView() {
  const now = Date.now();
  const rows = draws.map((d) => {
    let status = '<span class="status used">Không có mã</span>';
    let action = '';
    if (d.code) {
      if (d.redeemedAt) status = `<span class="status used">Đã đổi ${when(d.redeemedAt)}</span>`;
      else if (d.expires && d.expires < now) status = '<span class="status exp">Hết hạn</span>';
      else {
        status = '<span class="status new">Chưa đổi</span>';
        action = `<button class="btn small" data-action="redeem" data-code="${esc(d.code)}">Xác nhận đổi quà</button>`;
      }
    }
    return `<tr>
      <td class="code">${esc(d.code ?? '—')}${d.test ? ' <span class="tag">thử</span>' : ''}</td>
      <td><span class="dot" style="background:${RARITY[d.rarity]?.color ?? '#999'}"></span>${esc(d.prizeName)}${d.pity ? ' <span class="tag gold">bảo đảm</span>' : ''}</td>
      <td>${when(d.at)}</td>
      <td>${d.expires ? when(d.expires) : '—'}</td>
      <td>${status}</td>
      <td>${action}</td>
    </tr>`;
  }).join('');
  return `
    <div class="section-head"><h2>Mã quà</h2><span class="muted">${drawQuery ? `Kết quả cho “${esc(drawQuery)}”` : '100 lượt bốc gần nhất'}</span></div>
    <form class="search" id="codesearch">
      <input type="search" name="q" value="${esc(drawQuery)}" placeholder="Nhập mã khách đưa, VD: TAROT-7KQ2XM" autocomplete="off">
      <button class="btn primary" type="submit">Tìm</button>
    </form>
    <div class="panel table-wrap">
      ${draws.length ? `<table>
        <thead><tr><th>Mã quà</th><th>Món quà</th><th>Lúc trúng</th><th>Hạn dùng</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table>` : `<div class="empty">${drawQuery ? 'Không tìm thấy mã này.' : 'Chưa có lượt bốc nào.'}</div>`}
    </div>`;
}

async function loadDraws() {
  const r = await api<{ draws: Draw[] }>('GET', `/admin/draws${drawQuery ? `?q=${encodeURIComponent(drawQuery)}` : ''}`);
  draws = r.draws;
  if (tab === 'codes') renderTab();
}

// ---------------------------------------------------------------- settings
function settingsView() {
  const s = state!.settings;
  return `
    <div class="section-head"><h2>Cài đặt</h2></div>
    <div class="cols">
      <form class="panel" id="settings">
        <h3>Cửa hàng &amp; lượt chơi</h3>
        <div class="form-grid">
          <label class="f"><span>Tên cửa hàng</span><input type="text" name="shopName" value="${esc(s.shopName)}"></label>
          <label class="f"><span>Tên game</span><input type="text" name="gameTitle" value="${esc(s.gameTitle)}" required></label>
          <label class="f wide"><span>Câu giới thiệu</span><input type="text" name="subtitle" value="${esc(s.subtitle)}"></label>
          <label class="f"><span>Lượt bốc mỗi ngày</span><input type="number" name="turnsPerDay" min="1" max="99" value="${s.turnsPerDay}"></label>
          <label class="f"><span>Bảo đảm quà Hiếm sau</span><input type="number" name="pityEvery" min="0" max="50" value="${s.pityEvery}">
            <span class="hint">Số lượt liên tiếp chỉ trúng quà Thường. 0 là tắt.</span></label>
          <label class="f"><span>Hạn dùng mã quà (ngày)</span><input type="number" name="voucherDays" min="0" max="365" value="${s.voucherDays}">
            <span class="hint">0 là không hết hạn.</span></label>
          <label class="f"><span>Tiền tố mã</span><input type="text" name="codePrefix" value="${esc(s.codePrefix)}" maxlength="10">
            <span class="hint">Mã sẽ có dạng ${esc(s.codePrefix)}-7KQ2XM.</span></label>
          <label class="f wide"><span>Lời dặn khi đổi quà</span><input type="text" name="redeemNote" value="${esc(s.redeemNote)}"></label>
        </div>
        <div style="margin-top:16px"><button class="btn primary" type="submit">Lưu cài đặt</button></div>
      </form>
      <form class="panel" id="password">
        <h3>Đổi mật khẩu</h3>
        ${state!.passwordFromEnv
          ? '<p class="muted">Mật khẩu đang được đặt bằng biến môi trường <code>ADMIN_PASSWORD</code> trên máy chủ.</p>'
          : `<div style="display:grid;gap:12px">
              <label class="f"><span>Mật khẩu hiện tại</span><input type="password" name="current" autocomplete="current-password" required></label>
              <label class="f"><span>Mật khẩu mới (ít nhất 6 ký tự)</span><input type="password" name="next" autocomplete="new-password" minlength="6" required></label>
              <label class="f"><span>Nhập lại mật khẩu mới</span><input type="password" name="again" autocomplete="new-password" minlength="6" required></label>
              <button class="btn" type="submit">Đổi mật khẩu</button>
            </div>`}
      </form>
    </div>`;
}

// ---------------------------------------------------------------- events
app.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  const k = el.dataset.k;
  const card = el.closest<HTMLElement>('.prize');
  if (!k || !card) return;
  const p = draft[Number(card.dataset.i)];
  if (k === 'name' || k === 'desc') p[k] = el.value;
  else if (k === 'rate') p.rate = Math.max(0, Number(el.value) || 0);
  else if (k === 'quantity' || k === 'dailyLimit') p[k] = el.value === '' ? null : Math.max(0, Math.floor(Number(el.value)));
  else if (k === 'extraTurns') p.extraTurns = Math.max(0, Math.floor(Number(el.value) || 0));
  else return;
  markDirty();
  updateMeter();
});

app.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  const k = el.dataset.k;
  const card = el.closest<HTMLElement>('.prize');
  if (!k || !card) return;
  const i = Number(card.dataset.i);
  const p = draft[i];
  if (k === 'active') {
    p.active = (el as HTMLInputElement).checked;
    card.classList.toggle('off', !p.active);
  } else if (k === 'voucher') p.voucher = (el as HTMLInputElement).checked;
  else if (k === 'rarity') {
    card.classList.remove(p.rarity);
    p.rarity = el.value as Rarity;
    card.classList.add(p.rarity);
  } else if (k === 'icon') {
    p.icon = el.value;
    card.querySelector('.p-icon img')!.setAttribute('src', iconUrl(p.icon));
  } else if (k === 'fallback') {
    draft.forEach((q, j) => (q.fallback = j === i));
    // a fallback is never limited
    p.quantity = null;
    p.dailyLimit = null;
    p.active = true;
    $('#prizes')!.innerHTML = draft.map(prizeCard).join('');
  } else return;
  markDirty();
  updateMeter();
});

app.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action],[data-tab]');
  if (!el) return;
  if (el.dataset.tab) {
    if (dirty && el.dataset.tab !== 'prizes' && !confirm('Có thay đổi về quà chưa lưu. Vẫn chuyển trang?')) return;
    if (dirty && el.dataset.tab !== 'prizes') setState(state!);
    tab = el.dataset.tab as typeof tab;
    renderTab();
    if (tab === 'codes') loadDraws().catch((ex) => toast((ex as Error).message));
    return;
  }
  const action = el.dataset.action;
  try {
    if (action === 'logout') logout();
    else if (action === 'add') {
      draft.push({ id: newId(), name: '', desc: '', icon: 'giftbox', rarity: 'common', rate: 0, quantity: null, dailyLimit: null, won: 0, wonToday: 0, voucher: true, extraTurns: 0, active: true, fallback: false });
      $('#prizes')!.insertAdjacentHTML('beforeend', prizeCard(draft[draft.length - 1], draft.length - 1));
      markDirty();
      updateMeter();
      const last = app.querySelector<HTMLInputElement>('.prize:last-child input[data-k=name]');
      last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      last?.focus();
    } else if (action === 'remove') {
      const i = Number(el.closest<HTMLElement>('.prize')!.dataset.i);
      const p = draft[i];
      if (p.fallback) return toast('Hãy chọn món khác làm quà dự phòng trước khi xóa món này.');
      if (!confirm(`Xóa “${p.name || 'món quà mới'}”? Các mã quà đã phát vẫn được giữ.`)) return;
      draft.splice(i, 1);
      $('#prizes')!.innerHTML = draft.map(prizeCard).join('');
      markDirty();
      updateMeter();
    } else if (action === 'undo') {
      setState(state!);
      renderTab();
    } else if (action === 'save') {
      const s = await api<AdminState>('PUT', '/admin/prizes', { prizes: draft });
      setState(s);
      renderTab();
      toast('Đã lưu danh sách quà');
    } else if (action === 'reset-won') {
      if (dirty) return toast('Hãy lưu hoặc hoàn tác thay đổi trước.');
      if (!confirm('Đặt lại “Đã trúng” của mọi món về 0 (dùng khi bắt đầu đợt khuyến mại mới)? Lịch sử mã quà vẫn được giữ.')) return;
      setState(await api<AdminState>('POST', '/admin/reset-won'));
      renderTab();
      toast('Đã đặt lại số đã trúng');
    } else if (action === 'redeem') {
      const code = el.dataset.code!;
      if (!confirm(`Xác nhận khách đã nhận quà cho mã ${code}?`)) return;
      await api('POST', '/admin/redeem', { code });
      toast(`Đã xác nhận đổi quà ${code}`);
      await loadDraws();
      state = await api<AdminState>('GET', '/admin/state');
    }
  } catch (ex) {
    if (action === 'save') {
      saveError = (ex as Error).message;
      updateSavebar();
    } else toast((ex as Error).message);
  }
});

app.addEventListener('submit', async (e) => {
  const form = e.target as HTMLFormElement;
  if (!['codesearch', 'settings', 'password'].includes(form.id)) return;
  e.preventDefault();
  const fd = new FormData(form);
  try {
    if (form.id === 'codesearch') {
      drawQuery = String(fd.get('q') ?? '').trim().toUpperCase();
      await loadDraws();
    } else if (form.id === 'settings') {
      const s = Object.fromEntries(fd.entries()) as Record<string, string>;
      const settings = { ...s, codePrefix: s.codePrefix.trim().toUpperCase(), turnsPerDay: Number(s.turnsPerDay), pityEvery: Number(s.pityEvery), voucherDays: Number(s.voucherDays) };
      setState(await api<AdminState>('PUT', '/admin/settings', { settings }));
      renderShell();
      toast('Đã lưu cài đặt');
    } else {
      if (fd.get('next') !== fd.get('again')) return toast('Hai lần nhập mật khẩu mới không khớp.');
      await api('POST', '/admin/password', { current: fd.get('current'), next: fd.get('next') });
      form.reset();
      toast('Đã đổi mật khẩu');
    }
  } catch (ex) {
    toast((ex as Error).message);
  }
});

window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});

// keep counters live while nobody is editing
setInterval(async () => {
  if (!state || dirty || tab !== 'prizes' || document.visibilityState !== 'visible') return;
  if (app.contains(document.activeElement) && document.activeElement?.matches('input,select,textarea')) return;
  try {
    setState(await api<AdminState>('GET', '/admin/state'));
    renderTab();
  } catch {
    /* next tick */
  }
}, 20000);

async function boot() {
  if (!token) return renderLogin();
  try {
    setState(await api<AdminState>('GET', '/admin/state'));
    renderShell();
  } catch {
    /* api() already showed the login on 401 */
    if (!state && token) renderLogin('Không kết nối được máy chủ.');
  }
}

void boot();
