// Shop-editable configuration (public/config.json → dist/config.json after build).

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { label: string; color: string; tier: number }> = {
  common: { label: 'Thường', color: '#8fd8ff', tier: 0 },
  rare: { label: 'Hiếm', color: '#b98cff', tier: 1 },
  epic: { label: 'Sử Thi', color: '#ff6fb5', tier: 2 },
  legendary: { label: 'Huyền Thoại', color: '#ffcf5a', tier: 3 },
};
export const TIER_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const ICONS = ['star', 'hourglass', 'ticket', 'giftbox', 'tea', 'envelope', 'crown', 'cake', 'crystal'] as const;
export type IconName = (typeof ICONS)[number];

export interface Prize {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
  rarity: Rarity;
  weight: number;
  voucher: boolean;
  extraTurns: number;
}

export interface GameConfig {
  gameTitle: string;
  subtitle: string;
  shopName: string;
  turnsPerDay: number;
  pityEvery: number;
  voucherDays: number;
  codePrefix: string;
  redeemNote: string;
  prizes: Prize[];
}

const DEFAULTS: GameConfig = {
  gameTitle: 'Căn Phòng Tarot',
  subtitle: 'Bốc một lá bài — nhận thông điệp và món quà từ vũ trụ',
  shopName: '',
  turnsPerDay: 3,
  pityEvery: 5,
  voucherDays: 7,
  codePrefix: 'TAROT',
  redeemNote: 'Đưa mã này cho nhân viên khi thanh toán để nhận quà.',
  prizes: [
    { id: 'wish', name: 'Lời chúc may mắn', desc: 'Vũ trụ gửi bạn một ngày tràn đầy năng lượng tích cực!', icon: 'star', rarity: 'common', weight: 40, voucher: false, extraTurns: 0 },
    { id: 'turn', name: 'Thêm 1 lượt bốc', desc: 'Định mệnh cho bạn thêm một cơ hội!', icon: 'hourglass', rarity: 'common', weight: 20, voucher: false, extraTurns: 1 },
    { id: 'off10', name: 'Voucher giảm 10%', desc: 'Giảm 10% cho hóa đơn tiếp theo.', icon: 'ticket', rarity: 'rare', weight: 25, voucher: true, extraTurns: 0 },
    { id: 'drink', name: 'Miễn phí 1 đồ uống', desc: 'Một ly đồ uống bất kỳ.', icon: 'tea', rarity: 'epic', weight: 10, voucher: true, extraTurns: 0 },
    { id: 'jackpot', name: 'Giải Đặc Biệt', desc: 'Phần quà đặc biệt nhất!', icon: 'crown', rarity: 'legendary', weight: 5, voucher: true, extraTurns: 0 },
  ],
};

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v : fallback;
}
function num(v: unknown, fallback: number, min = 0): number {
  return typeof v === 'number' && isFinite(v) && v >= min ? v : fallback;
}

export async function loadConfig(): Promise<GameConfig> {
  let raw: Record<string, unknown> = {};
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
    if (res.ok) raw = await res.json();
    else console.warn('config.json not found, using defaults');
  } catch (e) {
    console.warn('config.json could not be read, using defaults', e);
  }
  const prizes: Prize[] = [];
  if (Array.isArray(raw.prizes)) {
    for (const p of raw.prizes as Record<string, unknown>[]) {
      const rarity = (TIER_ORDER as string[]).includes(p.rarity as string) ? (p.rarity as Rarity) : 'common';
      const icon = (ICONS as readonly string[]).includes(p.icon as string) ? (p.icon as IconName) : 'giftbox';
      const weight = num(p.weight, 0);
      if (weight <= 0) continue;
      prizes.push({
        id: str(p.id, `prize${prizes.length}`),
        name: str(p.name, 'Món quà bí ẩn'),
        desc: str(p.desc, ''),
        icon,
        rarity,
        weight,
        voucher: p.voucher !== false,
        extraTurns: Math.floor(num(p.extraTurns, 0)),
      });
    }
  }
  return {
    gameTitle: str(raw.gameTitle, DEFAULTS.gameTitle),
    subtitle: str(raw.subtitle, DEFAULTS.subtitle),
    shopName: str(raw.shopName, DEFAULTS.shopName),
    turnsPerDay: Math.floor(num(raw.turnsPerDay, DEFAULTS.turnsPerDay, 1)),
    pityEvery: Math.floor(num(raw.pityEvery, DEFAULTS.pityEvery)),
    voucherDays: num(raw.voucherDays, DEFAULTS.voucherDays),
    codePrefix: str(raw.codePrefix, DEFAULTS.codePrefix),
    redeemNote: str(raw.redeemNote, DEFAULTS.redeemNote),
    prizes: prizes.length ? prizes : DEFAULTS.prizes,
  };
}
