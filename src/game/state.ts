// Player progress: daily turns, pity meter, card collection and won gifts (localStorage).

import { LUCKY_CARDS, TAROT } from '../data/tarot';
import { RARITY, toPrize, type GameConfig, type Prize } from './config';

export interface WalletItem {
  code: string | null;
  prizeId: string;
  name: string;
  desc: string;
  icon: string;
  rarity: Prize['rarity'];
  cardId: number;
  at: number;
  expires: number | null;
}

interface SaveData {
  v: 1;
  /** Anonymous id the prize server keys this player by (pity streak, draw log). */
  player: string;
  day: string;
  turns: number;
  pity: number;
  draws: number;
  collection: Record<string, number>;
  wallet: WalletItem[];
}

export interface DrawResult {
  card: (typeof TAROT)[number];
  prize: Prize;
  item: WalletItem;
  newCard: boolean;
  pityTriggered: boolean;
}

const KEY = 'tarot-room-save-v1';

/** Random id; crypto.randomUUID needs a secure context, getRandomValues works on plain http too. */
function newPlayerId(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return `p-${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`;
}

interface ServerDraw {
  prize: Record<string, unknown> & { id: string };
  code: string | null;
  expires: number | null;
  at: number;
  pityTriggered: boolean;
  streak: number;
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weighted<T>(items: T[], weight: (t: T) => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let r = Math.random() * total;
  for (const t of items) {
    r -= weight(t);
    if (r <= 0) return t;
  }
  return items[items.length - 1];
}

export class GameState {
  data: SaveData;
  /** Dev/capture only: force the next draws' rarity. */
  forceRarity: Prize['rarity'] | null = null;
  /** Dev/capture only: force the next draws' card (0..21). */
  forceCard: number | null = null;
  private cfg: GameConfig;
  private listeners = new Set<() => void>();

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.data = this.load();
    // Test helpers, only in `npm run dev` (stripped from the production build).
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(location.search);
      if (params.has('turns')) this.data.turns = Math.max(0, parseInt(params.get('turns') || '0', 10) || 0);
    }
    this.refreshDay();
    this.save();
  }

  private fresh(): SaveData {
    return { v: 1, player: newPlayerId(), day: today(), turns: this.cfg.turnsPerDay, pity: 0, draws: 0, collection: {}, wallet: [] };
  }

  private load(): SaveData {
    try {
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('reset')) localStorage.removeItem(KEY);
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as SaveData;
        if (d && d.v === 1) {
          const out = { ...this.fresh(), ...d };
          if (!out.player) out.player = newPlayerId();
          return out;
        }
      }
    } catch {
      /* storage blocked: play without persistence */
    }
    return this.fresh();
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
    for (const fn of this.listeners) fn();
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
  }

  /** New calendar day → turns refill to the daily amount. */
  refreshDay(): boolean {
    const t = today();
    if (this.data.day !== t) {
      this.data.day = t;
      this.data.turns = Math.max(this.data.turns, this.cfg.turnsPerDay);
      this.save();
      return true;
    }
    return false;
  }

  get turns() {
    return this.data.turns;
  }
  get pity() {
    return this.data.pity;
  }
  get pityMax() {
    return this.cfg.pityEvery;
  }
  get pityReady() {
    return this.cfg.pityEvery > 0 && this.data.pity >= this.cfg.pityEvery;
  }
  get collectedCount() {
    return Object.keys(this.data.collection).length;
  }

  msUntilReset(): number {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  private makeCode(): string {
    let s = '';
    for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return `${this.cfg.codePrefix}-${s}`;
  }

  /**
   * Spend a turn and decide the outcome before the reveal animation starts (saved first, so a
   * refresh mid-reveal can't re-roll or lose the gift). With the prize server, the server picks
   * the prize, counts it against the stock and issues the code; a failed request refunds the turn.
   */
  async draw(): Promise<DrawResult | null> {
    this.refreshDay();
    if (this.data.turns <= 0) return null;
    this.data.turns -= 1;
    if (!this.cfg.server) return this.drawLocal();
    this.save();
    let r: ServerDraw;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: this.data.player, force: import.meta.env.DEV ? this.forceRarity : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Máy chủ lỗi ${res.status}`);
      r = data as ServerDraw;
    } catch (e) {
      this.data.turns += 1;
      this.save();
      throw e;
    }
    const prize = this.cfg.prizes.find((p) => p.id === r.prize.id) ?? toPrize(r.prize, 0, 0);
    this.data.pity = r.streak;
    return this.finish(prize, r.pityTriggered, r.code, r.expires, r.at);
  }

  /** No server: pick by weight on this device. */
  private drawLocal(): DrawResult {
    const pityTriggered = this.pityReady;
    let pool = this.cfg.prizes;
    if (pityTriggered) {
      const better = pool.filter((p) => RARITY[p.rarity].tier >= 1);
      if (better.length) pool = better;
    }
    if (import.meta.env.DEV && this.forceRarity) {
      const forced = this.cfg.prizes.filter((p) => p.rarity === this.forceRarity);
      if (forced.length) pool = forced;
    }
    const prize = weighted(pool, (p) => p.weight);
    this.data.pity = RARITY[prize.rarity].tier >= 1 ? 0 : this.data.pity + 1;
    const now = Date.now();
    const expires = prize.voucher && this.cfg.voucherDays > 0 ? now + this.cfg.voucherDays * 86400000 : null;
    return this.finish(prize, pityTriggered, prize.voucher ? this.makeCode() : null, expires, now);
  }

  /** Card, collection, bonus turns and wallet: the same for both kinds of draw. */
  private finish(prize: Prize, pityTriggered: boolean, code: string | null, expires: number | null, at: number): DrawResult {
    const tier = RARITY[prize.rarity].tier;
    // Choose the card: uncollected cards are favoured; big wins favour "lucky" cards.
    const col = this.data.collection;
    const forced = import.meta.env.DEV && this.forceCard !== null ? TAROT[this.forceCard] : undefined;
    const card = forced ?? weighted(TAROT, (c) => {
      let w = col[c.id] ? 1 : 2.5;
      if (tier >= 2 && LUCKY_CARDS.includes(c.id)) w *= 4;
      return w;
    });
    const newCard = !col[card.id];
    col[card.id] = (col[card.id] || 0) + 1;

    this.data.draws += 1;
    if (prize.extraTurns > 0) this.data.turns += prize.extraTurns;

    const item: WalletItem = {
      code,
      prizeId: prize.id,
      name: prize.name,
      desc: prize.desc,
      icon: prize.icon,
      rarity: prize.rarity,
      cardId: card.id,
      at,
      expires,
    };
    if (prize.voucher) this.data.wallet.unshift(item);
    this.save();
    return { card, prize, item, newCard, pityTriggered };
  }
}
