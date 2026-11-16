// Types and fetch wrapper for the prize API (server/api.mjs).

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Prize {
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

export interface Settings {
  gameTitle: string;
  subtitle: string;
  shopName: string;
  turnsPerDay: number;
  pityEvery: number;
  voucherDays: number;
  codePrefix: string;
  redeemNote: string;
}

export interface AdminState {
  settings: Settings;
  prizes: Prize[];
  stats: { draws: number; drawsToday: number; codes: number; redeemed: number; players: number };
  passwordFromEnv: boolean;
}

export interface Draw {
  id: number;
  at: number;
  prizeId: string;
  prizeName: string;
  rarity: Rarity;
  code: string | null;
  expires: number | null;
  redeemedAt: number | null;
  pity: boolean;
  test: boolean;
}

export interface Stats {
  days: { day: string; draws: number; codes: number; redeemed: number }[];
  byPrize: { id: string; name: string; rarity: Rarity; count: number }[];
  totals: {
    draws: number;
    drawsToday: number;
    drawsYesterday: number;
    /** Yesterday's draws up to the same time of day as now. */
    drawsYesterdaySoFar: number;
    codes: number;
    codesToday: number;
    redeemed: number;
    active: number;
    expired: number;
    players: number;
    playersToday: number;
  };
}

const BASE = `${import.meta.env.BASE_URL}api`;
const TOKEN_KEY = 'tarot-admin-token';

function storage(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

let token: string | null = storage()?.getItem(TOKEN_KEY) ?? null;
let onAuthLost: (msg: string) => void = () => {};

export const auth = {
  get token() {
    return token;
  },
  set(t: string | null) {
    token = t;
    try {
      if (t) storage()?.setItem(TOKEN_KEY, t);
      else storage()?.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked: keep it in memory */
    }
  },
  onLost(fn: (msg: string) => void) {
    onAuthLost = fn;
  },
};

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/admin/login') {
    auth.set(null);
    onAuthLost(data.error || 'Phiên đăng nhập đã hết hạn.');
    throw new Error(data.error || 'Phiên đăng nhập đã hết hạn.');
  }
  if (!res.ok) throw new Error(data.error || `Máy chủ trả về lỗi ${res.status}.`);
  return data as T;
}
