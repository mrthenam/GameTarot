// Small UI kit for the admin: icons, formatting, toasts, confirm dialog, drawer, shared tooltip.
import {
  createElement, LayoutDashboard, Gift, TicketCheck, Settings, Moon, Sun, Menu, Search, LogOut, ExternalLink, Plus,
  Pencil, Trash2, RotateCcw, Sparkles, Ticket, Users, Percent, ChevronLeft, ChevronRight, X, Check, CircleCheck,
  CircleAlert, TriangleAlert, Eye, EyeOff, KeyRound, Store, Table2, ChartColumn, Package, RefreshCw, Dices, Clock,
  ShieldCheck, CircleX, Hourglass, Inbox, Lock, ArrowUp, ArrowDown, Minus, type IconNode,
} from 'lucide';
import type { Rarity } from './api';

const ICONS = {
  dashboard: LayoutDashboard, gift: Gift, ticketCheck: TicketCheck, settings: Settings, moon: Moon, sun: Sun, menu: Menu,
  search: Search, logout: LogOut, external: ExternalLink, plus: Plus, edit: Pencil, trash: Trash2, reset: RotateCcw,
  sparkles: Sparkles, ticket: Ticket, users: Users, percent: Percent, left: ChevronLeft, right: ChevronRight, x: X,
  check: Check, ok: CircleCheck, alert: CircleAlert, warn: TriangleAlert, eye: Eye, eyeOff: EyeOff, key: KeyRound,
  store: Store, table: Table2, chart: ChartColumn, package: Package, refresh: RefreshCw, dice: Dices, clock: Clock,
  shield: ShieldCheck, fail: CircleX, hourglass: Hourglass, inbox: Inbox, lock: Lock, up: ArrowUp, down: ArrowDown,
  minus: Minus,
} satisfies Record<string, IconNode>;
export type IconName = keyof typeof ICONS;

const iconCache = new Map<string, string>();
export function icon(name: IconName, size = 18): string {
  const k = `${name}:${size}`;
  let s = iconCache.get(k);
  if (!s) {
    const el = createElement(ICONS[name]);
    el.setAttribute('width', String(size));
    el.setAttribute('height', String(size));
    el.setAttribute('aria-hidden', 'true');
    s = el.outerHTML;
    iconCache.set(k, s);
  }
  return s;
}

const prizeIcons = import.meta.glob('../assets/icons/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const prizeIconUrl = (n: string) => prizeIcons[`../assets/icons/${n}.webp`] ?? prizeIcons['../assets/icons/giftbox.webp'];
export const PRIZE_ICONS: Record<string, string> = {
  star: 'Ngôi sao', hourglass: 'Đồng hồ cát', ticket: 'Vé giảm giá', giftbox: 'Hộp quà', tea: 'Đồ uống',
  envelope: 'Bao lì xì', crown: 'Vương miện', cake: 'Bánh ngọt', crystal: 'Pha lê',
  bottle: 'Bình nước gấu', 'woven-bag': 'Túi nhựa đan', teddy: 'Gấu bông & túi gấm', notebook: 'Sổ tay',
  keychain: 'Móc khoá', bracelet: 'Vòng tay', topping: 'Topping', upsize: 'Nâng size', discount: 'Phiếu giảm 20%',
  buy2get1: 'Mua 2 tặng 1', bogo: 'Hóa đơn tặng ly', wishcard: 'Thẻ câu chúc',
};

export const RARITY: Record<Rarity, string> = { common: 'Thường', rare: 'Hiếm', epic: 'Sử Thi', legendary: 'Huyền Thoại' };
export const rarityBadge = (r: Rarity) => `<span class="badge r-${r}">${RARITY[r]}</span>`;

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const fmt = (n: number, digits = 0) => n.toLocaleString('vi-VN', { maximumFractionDigits: digits });
export const pct = (n: number, digits = 1) => `${fmt(n, digits)}%`;
const p2 = (n: number) => String(n).padStart(2, '0');
/** 16/11 14:05, or 16/11/2026 14:05 */
export function when(ms: number, withYear = false) {
  const d = new Date(ms);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}${withYear ? `/${d.getFullYear()}` : ''} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export function dayLabel(day: string, long = false) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return long
    ? dt.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
    : `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** Status of a voucher code as a badge. */
export function codeStatus(d: { code: string | null; redeemedAt: number | null; expires: number | null }, now = Date.now()) {
  if (!d.code) return { key: 'none', html: '<span class="badge b-muted">Không có mã</span>' };
  if (d.redeemedAt) return { key: 'redeemed', html: `<span class="badge b-info">${icon('check', 13)}Đã đổi</span>` };
  if (d.expires && d.expires < now) return { key: 'expired', html: `<span class="badge b-danger">${icon('clock', 13)}Hết hạn</span>` };
  return { key: 'active', html: `<span class="badge b-success">${icon('ticket', 13)}Chưa đổi</span>` };
}

// ---------------------------------------------------------------- toasts
let toastBox: HTMLElement | null = null;
export function toast(msg: string, kind: 'ok' | 'error' = 'ok') {
  if (!toastBox) {
    toastBox = document.createElement('div');
    toastBox.className = 'toasts';
    toastBox.setAttribute('role', 'status');
    document.body.append(toastBox);
  }
  const t = document.createElement('div');
  t.className = `toast ${kind === 'error' ? 'error' : ''}`;
  t.innerHTML = `${icon(kind === 'error' ? 'alert' : 'ok', 18)}<span>${esc(msg)}</span>`;
  toastBox.append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 4500 : 2600);
}

// ---------------------------------------------------------------- confirm dialog
export function confirmDialog(opts: { title: string; body: string; ok: string; danger?: boolean; tone?: 'warning' | 'primary' }): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    const tone = opts.danger ? 'tone-warning' : opts.tone === 'warning' ? 'tone-warning' : 'tone-primary';
    wrap.innerHTML = `
      <div class="backdrop"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mdl-title">
        <div class="kpi-icon ${tone}">${icon(opts.danger ? 'warn' : 'alert', 22)}</div>
        <h3 id="mdl-title">${esc(opts.title)}</h3>
        <p>${opts.body}</p>
        <div class="modal-actions">
          <button class="btn" data-x="cancel">Hủy</button>
          <button class="btn ${opts.danger ? 'danger' : 'primary'}" data-x="ok">${esc(opts.ok)}</button>
        </div>
      </div>`;
    const close = (v: boolean) => {
      wrap.remove();
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    wrap.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.classList.contains('backdrop') || t.closest('[data-x=cancel]')) close(false);
      else if (t.closest('[data-x=ok]')) close(true);
    });
    document.addEventListener('keydown', onKey);
    document.body.append(wrap);
    wrap.querySelector<HTMLButtonElement>('[data-x=ok]')?.focus();
  });
}

// ---------------------------------------------------------------- drawer
export interface Drawer {
  el: HTMLElement;
  body: HTMLElement;
  close: () => void;
}
export function openDrawer(title: string, bodyHtml: string, footHtml: string, onClose?: () => void): Drawer {
  const wrap = document.createElement('div');
  wrap.className = 'drawer-wrap';
  wrap.innerHTML = `
    <div class="backdrop"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drw-title">
      <div class="drawer-head"><h2 id="drw-title">${esc(title)}</h2><button class="icon-btn" data-x="close" aria-label="Đóng">${icon('x')}</button></div>
      <div class="drawer-body">${bodyHtml}</div>
      <div class="drawer-foot">${footHtml}</div>
    </aside>`;
  const close = () => {
    wrap.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  wrap.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.classList.contains('backdrop') || t.closest('[data-x=close]')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  return { el: wrap, body: wrap.querySelector('.drawer-body')!, close };
}

// ---------------------------------------------------------------- tooltip (charts)
export function showTip(host: HTMLElement, x: number, y: number, html: string) {
  let tip = host.querySelector<HTMLElement>('.tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tip';
    tip.setAttribute('role', 'tooltip');
    host.append(tip);
  }
  tip.innerHTML = html;
  const w = host.clientWidth;
  tip.style.left = `${Math.max(80, Math.min(w - 80, x))}px`;
  tip.style.top = `${y}px`;
  tip.style.display = 'block';
}
export function hideTip(host: HTMLElement) {
  const tip = host.querySelector<HTMLElement>('.tip');
  if (tip) tip.style.display = 'none';
}
