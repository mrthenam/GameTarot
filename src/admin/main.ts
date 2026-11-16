// Admin dashboard (admin.html): sidebar + topbar shell, hash routes, login, light/dark theme.
// Pages: Tổng quan (#/), Quà & tỉ lệ (#/qua), Mã quà (#/ma-qua), Cài đặt (#/cai-dat).
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import './admin.css';
import { api, auth, type AdminState } from './api';
import { esc, icon, prizeIconUrl, toast, type IconName } from './ui';
import { renderOverview } from './pages/overview';
import { renderPrizes } from './pages/prizes';
import { renderCodes } from './pages/codes';
import { renderSettings } from './pages/settings';

export interface Ctx {
  state: AdminState;
  setState: (s: AdminState) => void;
  refreshShell: () => void;
}

type Route = 'overview' | 'prizes' | 'codes' | 'settings';
const ROUTES: Record<Route, { hash: string; title: string; icon: IconName; group: string }> = {
  overview: { hash: '#/', title: 'Tổng quan', icon: 'dashboard', group: 'Tổng quan' },
  prizes: { hash: '#/qua', title: 'Quà & tỉ lệ', icon: 'gift', group: 'Quản lý' },
  codes: { hash: '#/ma-qua', title: 'Mã quà', icon: 'ticketCheck', group: 'Quản lý' },
  settings: { hash: '#/cai-dat', title: 'Cài đặt', icon: 'settings', group: 'Hệ thống' },
};

const app = document.getElementById('app')!;
const THEME_KEY = 'tarot-admin-theme';
/** The game's name from settings (Cài đặt → Tên game); the login page reads it from /api/config. */
let gameTitle = 'Tarot Ánh Trăng';
let cleanup: (() => void) | null = null;
let refreshTimer = 0;

const ctx: Ctx = {
  state: null as unknown as AdminState,
  setState(s) {
    ctx.state = s;
    gameTitle = s.settings.gameTitle || gameTitle;
  },
  refreshShell: () => renderShell(),
};

// ---------------------------------------------------------------- theme
function savedTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
function setTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {
    /* per-viewer convenience only */
  }
}
const t0 = savedTheme();
if (t0 === 'dark' || t0 === 'light') document.documentElement.dataset.theme = t0;

// ---------------------------------------------------------------- routing
function parseHash(): { route: Route; params: URLSearchParams } {
  const [path, query] = location.hash.replace(/^#/, '').split('?');
  const route = (Object.keys(ROUTES) as Route[]).find((r) => ROUTES[r].hash === `#${path || '/'}`) ?? 'overview';
  return { route, params: new URLSearchParams(query ?? '') };
}

const brand = (sub: string) => `
  <div class="brand">
    <div class="brand-mark"><img src="${prizeIconUrl('crystal')}" alt=""></div>
    <div><b>${esc(gameTitle)}</b><small>${esc(sub)}</small></div>
  </div>`;

// ---------------------------------------------------------------- login
function renderLogin(err = '') {
  clearInterval(refreshTimer);
  cleanup?.();
  cleanup = null;
  app.innerHTML = `
    <div class="login">
      <div class="login-card">
        ${brand('Trang quản trị')}
        <h1>Đăng nhập quản trị</h1>
        <p class="sub">Quản lý quà, tỉ lệ trúng và mã quà của cửa hàng.</p>
        <form id="login">
          <div class="field"><label for="pw">Mật khẩu</label>
            <div class="input-group"><input class="input" id="pw" type="password" name="pw" autocomplete="current-password" required autofocus>
              <button type="button" class="suffix" id="peek" aria-label="Hiện mật khẩu">${icon('eye', 17)}</button></div></div>
          ${err ? `<div class="form-error">${icon('alert', 16)}<span>${esc(err)}</span></div>` : ''}
          <button class="btn primary" type="submit">${icon('lock', 16)}Đăng nhập</button>
        </form>
        <p class="login-foot">Nếu chưa đặt biến <code>ADMIN_PASSWORD</code>, máy chủ tự tạo mật khẩu ở lần chạy đầu, in ra log và lưu ở <code>admin-password.txt</code> trong thư mục dữ liệu.</p>
      </div>
    </div>`;
  const pw = app.querySelector<HTMLInputElement>('#pw')!;
  app.querySelector('#peek')!.addEventListener('click', (e) => {
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    const b = e.currentTarget as HTMLButtonElement;
    b.innerHTML = icon(show ? 'eyeOff' : 'eye', 17);
    b.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
  });
  app.querySelector('#login')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = app.querySelector<HTMLButtonElement>('#login button[type=submit]')!;
    btn.disabled = true;
    try {
      const r = await api<{ token: string }>('POST', '/admin/login', { password: pw.value.trim() });
      auth.set(r.token);
      await boot();
    } catch (ex) {
      renderLogin((ex as Error).message);
    }
  });
}
auth.onLost((msg) => renderLogin(msg));

// ---------------------------------------------------------------- shell
function renderShell() {
  const { route } = parseHash();
  const groups = ['Tổng quan', 'Quản lý', 'Hệ thống'];
  const s = ctx.state.settings;
  app.innerHTML = `
    <div class="layout" id="layout">
      <aside class="sidebar" aria-label="Điều hướng">
        ${brand(s.shopName || 'Trang quản trị')}
        <nav class="side-scroll">
          ${groups.map((g) => `<div class="side-label">${g}</div>${(Object.keys(ROUTES) as Route[]).filter((r) => ROUTES[r].group === g).map((r) =>
            `<a class="side-link ${r === route ? 'on' : ''}" href="${ROUTES[r].hash}" ${r === route ? 'aria-current="page"' : ''}>${icon(ROUTES[r].icon, 19)}<span>${ROUTES[r].title}</span>${r === 'prizes' ? `<span class="count">${ctx.state.prizes.filter((p) => p.active).length}</span>` : ''}</a>`).join('')}`).join('')}
          <div class="side-label">Liên kết</div>
          <a class="side-link" href="./" target="_blank" rel="noopener">${icon('sparkles', 19)}<span>Mở game</span>${icon('external', 14)}</a>
        </nav>
        <div class="side-foot"><div class="avatar">QT</div><div><b>Quản trị viên</b><small>${esc(s.gameTitle)}</small></div></div>
      </aside>
      <div class="backdrop side" data-act="close-nav"></div>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" data-act="open-nav" aria-label="Mở menu">${icon('menu', 20)}</button>
          <form class="top-search" id="quick" role="search">
            ${icon('search', 16)}<input class="input mono" name="q" placeholder="Tra mã quà khách đưa…" autocomplete="off" aria-label="Tra mã quà">
          </form>
          <div class="top-actions">
            <a class="btn sm hide-sm" href="./" target="_blank" rel="noopener">${icon('external', 15)}Mở game</a>
            <button class="icon-btn" data-act="theme" aria-label="${isDark() ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}" title="Đổi giao diện sáng/tối">${icon(isDark() ? 'sun' : 'moon', 19)}</button>
            <button class="user-btn" data-act="user" aria-haspopup="menu" aria-expanded="false"><div class="avatar">QT</div><span><b>Quản trị viên</b><small>Toàn quyền</small></span></button>
          </div>
        </header>
        <main class="content">
          <div class="page-head">
            <div>
              <h1 id="page-title"></h1>
              <div class="crumbs"><span>${esc(gameTitle)}</span>${icon('right', 13)}<b id="crumb"></b></div>
            </div>
            <div class="head-actions" id="head-actions"></div>
          </div>
          <div id="view"></div>
        </main>
        <footer class="footer"><span>© ${new Date().getFullYear()} ${esc(s.shopName || s.gameTitle)} · Trang quản trị</span><span>Dữ liệu cập nhật trực tiếp từ máy chủ quà</span></footer>
      </div>
    </div>`;
  void renderRoute();
}

async function renderRoute() {
  const { route, params } = parseHash();
  cleanup?.();
  cleanup = null;
  clearInterval(refreshTimer);
  document.getElementById('layout')?.classList.remove('nav-open');
  app.querySelectorAll('.side-link[href^="#"]').forEach((a) => {
    const on = a.getAttribute('href') === ROUTES[route].hash;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const r = ROUTES[route];
  document.title = `${r.title} · Quản trị ${gameTitle}`;
  app.querySelector('#page-title')!.textContent = r.title;
  app.querySelector('#crumb')!.textContent = r.title;
  const actions = app.querySelector<HTMLElement>('#head-actions')!;
  actions.innerHTML = '';
  // a fresh view element per page, so page listeners never pile up
  const old = app.querySelector<HTMLElement>('#view')!;
  const view = document.createElement('div');
  view.id = 'view';
  old.replaceWith(view);
  try {
    if (route === 'overview') {
      actions.innerHTML = `<span class="hint" id="updated"></span><button class="btn sm" data-act="refresh">${icon('refresh', 15)}Làm mới</button>`;
      const load = async () => {
        ctx.setState(await api<AdminState>('GET', '/admin/state'));
        cleanup?.();
        cleanup = await renderOverview(view, ctx);
        const u = app.querySelector('#updated');
        if (u) u.textContent = `Cập nhật ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      };
      view.innerHTML = '<div class="empty">Đang tải số liệu…</div>';
      await load();
      actions.querySelector('[data-act=refresh]')!.addEventListener('click', () => load().then(() => toast('Đã làm mới số liệu')).catch((e) => toast((e as Error).message, 'error')));
      refreshTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible' && !document.querySelector('.drawer-wrap,.modal-wrap')) void load().catch(() => {});
      }, 30000);
    } else if (route === 'prizes') {
      const page = renderPrizes(view, ctx);
      actions.innerHTML = `<button class="btn sm" data-act="reset-won">${icon('reset', 15)}Đặt lại số đã trúng</button><button class="btn sm primary" data-act="add">${icon('plus', 15)}Thêm món quà</button>`;
      actions.querySelector('[data-act=add]')!.addEventListener('click', page.add);
      actions.querySelector('[data-act=reset-won]')!.addEventListener('click', () => void page.resetWon());
    } else if (route === 'codes') {
      renderCodes(view, ctx, params);
    } else {
      renderSettings(view, ctx);
    }
  } catch (e) {
    view.innerHTML = `<div class="card"><div class="empty"><div class="kpi-icon tone-warning">${icon('warn', 22)}</div><b>Không tải được dữ liệu</b><span>${esc((e as Error).message)}</span></div></div>`;
  }
  view.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- global events
app.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  const menu = document.querySelector('.menu-pop');
  if (menu && !(e.target as HTMLElement).closest('.menu-pop,[data-act=user]')) closeMenu();
  if (!t) return;
  const layout = document.getElementById('layout');
  switch (t.dataset.act) {
    case 'open-nav':
      layout?.classList.add('nav-open');
      break;
    case 'close-nav':
      layout?.classList.remove('nav-open');
      break;
    case 'theme': {
      setTheme(!isDark());
      t.innerHTML = icon(isDark() ? 'sun' : 'moon', 19);
      t.setAttribute('aria-label', isDark() ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
      if (parseHash().route === 'overview') void renderRoute();
      break;
    }
    case 'user':
      if (menu) closeMenu();
      else openMenu(t);
      break;
    case 'logout':
      closeMenu();
      auth.set(null);
      renderLogin();
      break;
  }
});

function openMenu(btn: HTMLElement) {
  const pop = document.createElement('div');
  pop.className = 'menu-pop';
  pop.setAttribute('role', 'menu');
  pop.innerHTML = `
    <a href="#/cai-dat" role="menuitem">${icon('settings', 17)}Cài đặt</a>
    <a href="./" target="_blank" rel="noopener" role="menuitem">${icon('sparkles', 17)}Mở game</a>
    <hr>
    <button data-act="logout" role="menuitem">${icon('logout', 17)}Đăng xuất</button>`;
  btn.setAttribute('aria-expanded', 'true');
  app.querySelector('.main')!.append(pop);
  pop.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) closeMenu();
  });
}
function closeMenu() {
  document.querySelector('.menu-pop')?.remove();
  app.querySelector('[data-act=user]')?.setAttribute('aria-expanded', 'false');
}

app.addEventListener('submit', (e) => {
  const f = e.target as HTMLFormElement;
  if (f.id !== 'quick') return;
  e.preventDefault();
  const q = String(new FormData(f).get('q') ?? '').trim().toUpperCase();
  const next = `#/ma-qua${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  if (location.hash === next) void renderRoute();
  else location.hash = next;
  f.reset();
});

window.addEventListener('hashchange', () => {
  if (ctx.state && auth.token) void renderRoute();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMenu();
    document.getElementById('layout')?.classList.remove('nav-open');
  }
});

async function boot() {
  if (!auth.token) {
    renderLogin();
    // show the shop's own name on the login page too
    fetch(`${import.meta.env.BASE_URL}api/config`)
      .then((r) => r.json())
      .then((c) => {
        if (c?.settings?.gameTitle && !auth.token) {
          gameTitle = c.settings.gameTitle;
          app.querySelectorAll('.login .brand b').forEach((b) => (b.textContent = gameTitle));
        }
      })
      .catch(() => {});
    return;
  }
  try {
    ctx.setState(await api<AdminState>('GET', '/admin/state'));
    renderShell();
  } catch (e) {
    if (auth.token) renderLogin((e as Error).message);
  }
}

void boot();
