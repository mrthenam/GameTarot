// DOM overlay: HUD, witch speech bubble, hints, result panel, wallet & collection.
import { clock, ease } from '../core/time';
import { TAROT } from '../data/tarot';
import { RARITY, type GameConfig } from '../game/config';
import type { DrawResult, GameState, WalletItem } from '../game/state';
import type { AudioEngine } from '../audio/audio';
import { cardBackUrl, cardFaceUrl } from '../scene/cards';

const iconModules = import.meta.glob('../assets/icons/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export function iconUrl(name: string): string {
  return iconModules[`../assets/icons/${name}.webp`] ?? iconModules['../assets/icons/giftbox.webp'];
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmtDate = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
export const fmtCountdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const SVG = {
  bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  cards: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="10" height="15" rx="1.5" transform="rotate(-8 8.5 12.5)"/><rect x="10" y="4" width="10" height="15" rx="1.5" transform="rotate(8 15 11.5)"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m17 9 5 6m0-6-5 6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
};

export class UI {

  private cfg: GameConfig;
  private state: GameState;
  private audio: AudioEngine;
  private el: Record<string, HTMLElement> = {};
  private bubbleToken = 0;
  private hintText = '';
  bubbleAnchor = { x: 0, y: 0 };

  constructor(root: HTMLElement, cfg: GameConfig, state: GameState, audio: AudioEngine) {

    this.cfg = cfg;
    this.state = state;
    this.audio = audio;
    root.innerHTML = `
      <div class="intro" data-el="intro">
        <div class="intro-inner">
          <div class="intro-moon">☾</div>
          ${cfg.shopName ? `<div class="intro-shop">${esc(cfg.shopName)}</div>` : ''}
          <h1>${esc(cfg.gameTitle)}</h1>
          <p>${esc(cfg.subtitle)}</p>
          <button class="btn primary big" data-el="enter">Bước vào phòng</button>
          <div class="intro-turns" data-el="introTurns"></div>
        </div>
      </div>
      <header class="hud" data-el="hud">
        <div class="hud-left">
          <div class="turns">
            <span class="cap">Lượt bốc</span>
            <div class="orbs" data-el="orbs"></div>
          </div>
          <div class="pity" data-el="pity" title="Khi đầy, lá tiếp theo chắc chắn từ Hiếm trở lên">
            <span class="cap">Năng lượng vũ trụ</span>
            <div class="bar"><i data-el="pityFill"></i></div>
          </div>
        </div>
        <div class="hud-right">
          <button class="icon-btn" data-el="walletBtn" aria-label="Túi quà">${SVG.bag}<b data-el="walletBadge"></b></button>
          <button class="icon-btn" data-el="colBtn" aria-label="Bộ sưu tập">${SVG.cards}<b class="always" data-el="colBadge"></b></button>
          <button class="icon-btn" data-el="soundBtn" aria-label="Âm thanh">${SVG.sound}</button>
        </div>
      </header>
      <div class="bubble" data-el="bubble"><span data-el="bubbleText"></span></div>
      <div class="hint" data-el="hint"></div>
      <aside class="result" data-el="result"></aside>
      <div class="modal" data-el="modal"><div class="sheet" data-el="sheet"></div></div>
      <div class="toast" data-el="toast"></div>
    `;
    root.querySelectorAll<HTMLElement>('[data-el]').forEach((e) => (this.el[e.dataset.el!] = e));
    this.el.walletBtn.addEventListener('click', () => { this.audio.click(); this.openWallet(); });
    this.el.colBtn.addEventListener('click', () => { this.audio.click(); this.openCollection(); });
    this.el.soundBtn.addEventListener('click', () => {
      this.audio.setMuted(!this.audio.muted);
      this.el.soundBtn.innerHTML = this.audio.muted ? SVG.mute : SVG.sound;
    });
    this.el.modal.addEventListener('click', (e) => { if (e.target === this.el.modal) this.closeModal(); });
    this.refreshCounters();
  }

  // ------------------------------------------------------------ intro
  onEnter(fn: () => void) {
    this.el.enter.addEventListener('click', fn, { once: true });
  }
  setIntroTurns(n: number) {
    this.el.introTurns.textContent = n > 0 ? `Hôm nay bạn có ${n} lượt bốc bài` : 'Bạn đã dùng hết lượt hôm nay';
  }
  async hideIntro() {
    const e = this.el.intro;
    await clock.tween(0.9, (k) => {
      e.style.opacity = String(1 - k);
      e.style.transform = `scale(${1 + k * 0.06})`;
    }, ease.inOutSine);
    e.style.display = 'none';
  }
  showHud() {
    this.el.hud.classList.add('on');
  }

  // ------------------------------------------------------------ counters
  setTurns(n: number, pop = false) {
    const max = Math.max(this.cfg.turnsPerDay, n);
    const orbs = this.el.orbs;
    let html = '';
    if (max <= 6) {
      for (let i = 0; i < max; i++) html += `<i class="${i < n ? 'full' : ''}"></i>`;
    }
    html += `<span class="num">${n}</span>`;
    orbs.innerHTML = html;
    if (pop) {
      orbs.classList.remove('pop');
      void orbs.offsetWidth;
      orbs.classList.add('pop');
    }
  }
  refreshCounters() {
    const s = this.state;
    const pf = this.el.pityFill;
    const max = s.pityMax;
    this.el.pity.style.display = max > 0 ? '' : 'none';
    pf.style.width = `${max > 0 ? Math.min(1, s.pity / max) * 100 : 0}%`;
    this.el.pity.classList.toggle('ready', s.pityReady);
    const w = s.data.wallet.length;
    this.el.walletBadge.textContent = w ? String(w) : '';
    this.el.colBadge.textContent = `${s.collectedCount}/22`;
  }

  // ------------------------------------------------------------ witch bubble
  /** Typewriter speech bubble near the witch; driven by the game clock. */
  async say(text: string, hold = 3.2) {
    const token = ++this.bubbleToken;
    const b = this.el.bubble, t = this.el.bubbleText;
    b.classList.add('on');
    t.textContent = '';
    const chars = [...text];
    await clock.tween(Math.min(2.2, chars.length * 0.03), (_, raw) => {
      if (token !== this.bubbleToken) return;
      t.textContent = chars.slice(0, Math.ceil(raw * chars.length)).join('');
    }, ease.linear);
    await clock.wait(hold);
    if (token === this.bubbleToken) b.classList.remove('on');
  }
  hush() {
    this.bubbleToken++;
    this.el.bubble.classList.remove('on');
  }
  placeBubble(x: number, y: number) {
    const b = this.el.bubble;
    const w = window.innerWidth;
    const narrow = w < 700;
    const bw = b.offsetWidth || 280;
    let left = narrow ? (w - bw) / 2 : x + 70;
    left = Math.max(12, Math.min(w - bw - 12, left));
    b.style.left = `${left}px`;
    if (narrow) {
      // phones: sit above the hint line, clear of the cards
      b.style.top = '';
      b.style.bottom = '96px';
    } else {
      b.style.bottom = '';
      b.style.top = `${Math.max(70, y - 60)}px`;
    }
    b.classList.toggle('narrow', narrow);
  }

  // ------------------------------------------------------------ hint line
  hint(text: string | null, urgent = false) {
    const h = this.el.hint;
    if (!text) {
      h.classList.remove('on');
      this.hintText = '';
      return;
    }
    if (text !== this.hintText) h.innerHTML = text;
    this.hintText = text;
    h.classList.add('on');
    h.classList.toggle('urgent', urgent);
  }

  toast(msg: string) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add('on');
    window.setTimeout(() => t.classList.remove('on'), 1800);
  }

  // ------------------------------------------------------------ result
  /** Shows the reading + gift. Resolves when the player chooses to draw again / close. */
  showResult(r: DrawResult, turnsLeft: number): Promise<void> {
    const rar = RARITY[r.prize.rarity];
    const card = r.card;
    const p = this.el.result;
    p.style.setProperty('--tier', rar.color);
    p.className = `result tier-${r.prize.rarity}`;
    const item = r.item;
    const voucher = item.code
      ? `<div class="voucher">
           <div class="v-cap">Mã quà của bạn</div>
           <button class="v-code" data-copy="${esc(item.code)}">${esc(item.code)}<small>Chạm để sao chép</small></button>
           <div class="v-meta">${item.expires ? `Hạn dùng: ${fmtDate(item.expires)} · ` : ''}${esc(this.cfg.redeemNote)}</div>
         </div>`
      : '';
    const extra = r.prize.extraTurns > 0 ? `<div class="extra">+${r.prize.extraTurns} lượt bốc đã được cộng!</div>` : '';
    const next = turnsLeft > 0 ? `Bốc tiếp <span>· còn ${turnsLeft} lượt</span>` : 'Quay lại căn phòng';
    p.innerHTML = `
      <div class="r-rarity"><span>✦ ${rar.label} ✦</span></div>
      <div class="r-card">
        <div class="r-num">${card.numeral}</div>
        <div class="r-name">${esc(card.nameVi)}</div>
        <div class="r-en">${esc(card.nameEn)}</div>
        ${r.newCard ? `<div class="r-new">Lá mới cho bộ sưu tập · ${this.state.collectedCount}/22</div>` : ''}
      </div>
      <div class="r-keys">${card.keywords.map((k) => `<span>${esc(k)}</span>`).join('')}</div>
      <p class="r-msg" data-msg></p>
      <div class="r-div"><span>Món quà dành cho bạn</span></div>
      <div class="gift">
        <img src="${iconUrl(r.prize.icon)}" alt="">
        <div><div class="g-name">${esc(r.prize.name)}</div><div class="g-desc">${esc(r.prize.desc)}</div></div>
      </div>
      ${extra}${voucher}
      <div class="r-actions">
        <button class="btn primary" data-next>${next}</button>
        ${item.code ? '<button class="btn ghost" data-wallet>Túi quà</button>' : ''}
      </div>`;
    const msgEl = p.querySelector<HTMLElement>('[data-msg]')!;
    p.querySelector<HTMLElement>('[data-copy]')?.addEventListener('click', (e) => {
      const code = (e.currentTarget as HTMLElement).dataset.copy!;
      navigator.clipboard?.writeText(code).then(() => this.toast('Đã sao chép mã quà'), () => this.toast(code));
    });
    p.querySelector<HTMLElement>('[data-wallet]')?.addEventListener('click', () => this.openWallet());
    p.classList.add('on');
    p.scrollTop = 0;
    const portrait = window.innerWidth < window.innerHeight;
    void clock.tween(0.7, (k) => {
      p.style.opacity = String(k);
      p.style.transform = portrait ? `translateY(${(1 - k) * 60}px)` : `translateX(${(1 - k) * 60}px)`;
    }, ease.outCubic);
    const chars = [...card.message];
    void clock.tween(Math.min(3, chars.length * 0.022), (_, raw) => {
      msgEl.textContent = chars.slice(0, Math.ceil(raw * chars.length)).join('');
    }, ease.linear, 0.35);
    return new Promise((resolve) => {
      p.querySelector<HTMLElement>('[data-next]')!.addEventListener('click', () => {
        this.audio.click();
        msgEl.textContent = card.message;
        resolve();
      }, { once: true });
    });
  }

  async hideResult() {
    const p = this.el.result;
    const portrait = window.innerWidth < window.innerHeight;
    await clock.tween(0.35, (k) => {
      p.style.opacity = String(1 - k);
      p.style.transform = portrait ? `translateY(${k * 60}px)` : `translateX(${k * 60}px)`;
    }, ease.inCubic);
    p.classList.remove('on');
  }

  // ------------------------------------------------------------ modals
  private openModal(html: string) {
    this.el.sheet.innerHTML = `<button class="icon-btn close" data-close>${SVG.close}</button>${html}`;
    this.el.sheet.querySelector('[data-close]')!.addEventListener('click', () => this.closeModal());
    this.el.modal.classList.add('on');
  }
  closeModal() {
    this.el.modal.classList.remove('on');
  }

  openWallet() {
    const items = this.state.data.wallet;
    const now = Date.now();
    const list = items.length
      ? items.map((it: WalletItem) => {
          const rar = RARITY[it.rarity];
          const expired = it.expires !== null && it.expires < now;
          return `<li style="--tier:${rar.color}" class="${expired ? 'expired' : ''}">
            <img src="${iconUrl(it.icon)}" alt="">
            <div class="w-main">
              <div class="w-name">${esc(it.name)} <em>${rar.label}</em></div>
              <div class="w-desc">${esc(it.desc)}</div>
              <div class="w-meta">Lá ${esc(TAROT[it.cardId].nameVi)} · ${fmtDate(it.at)}${it.expires ? ` · HSD ${fmtDate(it.expires)}` : ''}${expired ? ' · Đã hết hạn' : ''}</div>
            </div>
            <button class="w-code" data-copy="${esc(it.code ?? '')}">${esc(it.code ?? '')}</button>
          </li>`;
        }).join('')
      : '<p class="empty">Túi quà còn trống. Hãy bốc bài để nhận quà từ vũ trụ!</p>';
    this.openModal(`<h2>Túi quà của bạn</h2><p class="sub">${esc(this.cfg.redeemNote)}</p><ul class="wallet">${list}</ul>`);
    this.el.sheet.querySelectorAll<HTMLElement>('[data-copy]').forEach((b) =>
      b.addEventListener('click', () => navigator.clipboard?.writeText(b.dataset.copy!).then(() => this.toast('Đã sao chép mã quà'), () => {})),
    );
  }

  private fillFaces() {
    this.el.sheet.querySelectorAll<HTMLImageElement>('img[data-face]').forEach((img) => {
      void cardFaceUrl(Number(img.dataset.face)).then((url) => (img.src = url));
    });
  }

  openCollection() {
    const col = this.state.data.collection;
    const grid = TAROT.map((c) => {
      const n = col[c.id] || 0;
      return n
        ? `<button class="c-item got" data-card="${c.id}"><img data-face="${c.id}" src="${cardBackUrl}" alt=""><span class="c-name">${esc(c.nameVi)}</span>${n > 1 ? `<b>×${n}</b>` : ''}</button>`
        : `<div class="c-item"><img src="${cardBackUrl}" alt="" loading="lazy"><span class="c-name">${c.numeral} · ???</span></div>`;
    }).join('');
    this.openModal(`<h2>Bộ sưu tập Ẩn Chính</h2><p class="sub">Đã thu thập ${this.state.collectedCount}/22 lá. Bốc bài mỗi ngày để hoàn thành bộ bài!</p><div class="collection">${grid}</div>`);
    this.fillFaces();
    this.el.sheet.querySelectorAll<HTMLElement>('[data-card]').forEach((b) =>
      b.addEventListener('click', () => {
        const c = TAROT[Number(b.dataset.card)];
        this.openModal(`<div class="detail"><img data-face="${c.id}" src="${cardBackUrl}" alt=""><div><div class="r-num">${c.numeral}</div><h2>${esc(c.nameVi)}</h2><div class="r-en">${esc(c.nameEn)}</div><div class="r-keys">${c.keywords.map((k) => `<span>${esc(k)}</span>`).join('')}</div><p class="r-msg">${esc(c.message)}</p><button class="btn ghost" data-back>← Bộ sưu tập</button></div></div>`);
        this.fillFaces();
        this.el.sheet.querySelector('[data-back]')!.addEventListener('click', () => this.openCollection());
      }),
    );
  }
}
