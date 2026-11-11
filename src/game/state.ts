// Player progress: daily turns, pity meter, card collection and won gifts (localStorage).

import { LUCKY_CARDS, TAROT } from '../data/tarot';
import { RARITY, type GameConfig, type Prize } from './config';

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
    return { v: 1, day: today(), turns: this.cfg.turnsPerDay, pity: 0, draws: 0, collection: {}, wallet: [] };
  }

  private load(): SaveData {
    try {
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('reset')) localStorage.removeItem(KEY);
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as SaveData;
        if (d && d.v === 1) return { ...this.fresh(), ...d };
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
   * Spend a turn and decide the outcome immediately (saved before the reveal
   * animation, so a refresh mid-reveal can't re-roll or lose the gift).
   */
  draw(): DrawResult | null {
    this.refreshDay();
    if (this.data.turns <= 0) return null;
    this.data.turns -= 1;

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
    const tier = RARITY[prize.rarity].tier;

    // Choose the card: uncollected cards are favoured; big wins favour "lucky" cards.
    const col = this.data.collection;
    const card = weighted(TAROT, (c) => {
      let w = col[c.id] ? 1 : 2.5;
      if (tier >= 2 && LUCKY_CARDS.includes(c.id)) w *= 4;
      return w;
    });
    const newCard = !col[card.id];
    col[card.id] = (col[card.id] || 0) + 1;

    this.data.pity = tier >= 1 ? 0 : this.data.pity + 1;
    this.data.draws += 1;
    if (prize.extraTurns > 0) this.data.turns += prize.extraTurns;

    const now = Date.now();
    const item: WalletItem = {
      code: prize.voucher ? this.makeCode() : null,
      prizeId: prize.id,
      name: prize.name,
      desc: prize.desc,
      icon: prize.icon,
      rarity: prize.rarity,
      cardId: card.id,
      at: now,
      expires: prize.voucher && this.cfg.voucherDays > 0 ? now + this.cfg.voucherDays * 86400000 : null,
    };
    if (prize.voucher) this.data.wallet.unshift(item);
    this.save();
    return { card, prize, item, newCard, pityTriggered };
  }
}
