// Mã quà: status filter, search, paging, redeem.
import { api, type Draw } from '../api';
import { codeStatus, confirmDialog, esc, fmt, icon, prizeIconUrl, toast, when } from '../ui';
import type { Ctx } from '../main';

const PAGE = 20;
const FILTERS: [string, string][] = [['all', 'Tất cả'], ['active', 'Chưa đổi'], ['redeemed', 'Đã đổi'], ['expired', 'Hết hạn']];

export function renderCodes(view: HTMLElement, ctx: Ctx, params: URLSearchParams) {
  let status = params.get('status') ?? 'all';
  let q = (params.get('q') ?? '').toUpperCase();
  let page = 0;
  let total = 0;
  let rows: Draw[] = [];
  let loading = true;

  const iconOf = (id: string) => ctx.state.prizes.find((p) => p.id === id)?.icon ?? 'giftbox';

  const pager = () => {
    const pages = Math.max(1, Math.ceil(total / PAGE));
    const nums: (number | '…')[] = [];
    for (let i = 0; i < pages; i++) {
      if (i === 0 || i === pages - 1 || Math.abs(i - page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    return `<div class="pager" role="navigation" aria-label="Phân trang">
      <button data-page="${page - 1}" ${page === 0 ? 'disabled' : ''} aria-label="Trang trước">${icon('left', 16)}</button>
      ${nums.map((n) => (n === '…' ? '<span class="muted" style="padding:0 4px">…</span>' : `<button data-page="${n}" class="${n === page ? 'on' : ''}" ${n === page ? 'aria-current="page"' : ''}>${n + 1}</button>`)).join('')}
      <button data-page="${page + 1}" ${page >= pages - 1 ? 'disabled' : ''} aria-label="Trang sau">${icon('right', 16)}</button>
    </div>`;
  };

  const draw = () => {
    const from = total ? page * PAGE + 1 : 0;
    const to = Math.min(total, (page + 1) * PAGE);
    view.innerHTML = `
      <section class="card">
        <div class="card-head">
          <div class="seg" role="tablist" aria-label="Lọc theo trạng thái">
            ${FILTERS.map(([k, label]) => `<button data-status="${k}" class="${k === status ? 'on' : ''}" aria-pressed="${k === status}">${label}</button>`).join('')}
          </div>
          <form id="code-search" class="top-search" style="width:min(320px,100%)" role="search">
            ${icon('search', 16)}<input class="input mono" name="q" value="${esc(q)}" placeholder="Tìm mã, VD: TAROT-7KQ2XM" autocomplete="off" aria-label="Tìm mã quà">
          </form>
        </div>
        <div class="card-body flush">
          ${loading ? '<div class="empty">Đang tải…</div>' : rows.length ? `<div class="table-wrap"><table class="table stack-sm">
            <thead><tr><th>Mã quà</th><th>Món quà</th><th>Lúc trúng</th><th>Hạn dùng</th><th>Trạng thái</th><th class="right">Thao tác</th></tr></thead>
            <tbody>${rows.map((d) => {
              const st = codeStatus(d);
              return `<tr>
                <td class="cell-main"><b class="mono">${esc(d.code)}</b>${d.test ? ' <span class="badge b-muted">thử</span>' : ''}${d.pity ? ` <span class="badge b-primary" title="Trúng nhờ bảo đảm quà Hiếm">${icon('shield', 13)}bảo đảm</span>` : ''}</td>
                <td data-label="Món quà"><span style="display:inline-flex;align-items:center;gap:8px"><img src="${prizeIconUrl(iconOf(d.prizeId))}" alt="" width="24" height="24"><span><span class="dot ${d.rarity}"></span> ${esc(d.prizeName)}</span></span></td>
                <td data-label="Lúc trúng" class="num">${when(d.at, true)}</td>
                <td data-label="Hạn dùng" class="num ${st.key === 'expired' ? '' : 'muted'}">${d.expires ? when(d.expires, true) : 'Không hết hạn'}</td>
                <td data-label="Trạng thái">${st.html}${d.redeemedAt ? `<div class="hint">${when(d.redeemedAt)}</div>` : ''}</td>
                <td class="right">${st.key === 'active' ? `<button class="btn sm soft" data-redeem="${esc(d.code)}">${icon('check', 15)}Xác nhận đổi</button>` : ''}</td>
              </tr>`;
            }).join('')}</tbody></table></div>`
            : `<div class="empty"><div class="kpi-icon tone-info">${icon(q ? 'search' : 'inbox', 22)}</div><b>${q ? `Không tìm thấy mã “${esc(q)}”` : 'Chưa có mã quà nào'}</b><span>${q ? 'Kiểm tra lại mã khách đưa, hoặc đổi bộ lọc trạng thái.' : 'Mã được phát khi khách trúng món có mã voucher.'}</span></div>`}
        </div>
        ${total > 0 ? `<div class="card-foot"><span>Hiển thị <b class="num">${fmt(from)}–${fmt(to)}</b> trong <b class="num">${fmt(total)}</b> mã</span>${pager()}</div>` : ''}
      </section>`;
  };

  const load = async () => {
    loading = rows.length === 0;
    if (loading) draw();
    try {
      const r = await api<{ draws: Draw[]; total: number }>('GET', `/admin/draws?status=${status}&limit=${PAGE}&offset=${page * PAGE}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      rows = r.draws;
      total = r.total;
    } catch (e) {
      toast((e as Error).message, 'error');
    }
    loading = false;
    draw();
  };

  view.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const st = t.closest<HTMLElement>('[data-status]');
    if (st) {
      status = st.dataset.status!;
      page = 0;
      return void load();
    }
    const pg = t.closest<HTMLButtonElement>('[data-page]');
    if (pg && !pg.disabled) {
      page = Number(pg.dataset.page);
      return void load();
    }
    const rd = t.closest<HTMLElement>('[data-redeem]');
    if (rd) {
      const code = rd.dataset.redeem!;
      const d = rows.find((x) => x.code === code);
      const ok = await confirmDialog({
        title: 'Xác nhận đổi quà?',
        body: `Mã <b class="mono">${esc(code)}</b> · ${esc(d?.prizeName ?? '')}. Sau khi xác nhận, mã này không dùng lại được.`,
        ok: 'Đã giao quà',
      });
      if (!ok) return;
      try {
        await api('POST', '/admin/redeem', { code });
        toast(`Đã xác nhận đổi quà ${code}`);
        await load();
      } catch (ex) {
        toast((ex as Error).message, 'error');
      }
    }
  });
  view.addEventListener('submit', (e) => {
    const f = e.target as HTMLFormElement;
    if (f.id !== 'code-search') return;
    e.preventDefault();
    q = String(new FormData(f).get('q') ?? '').trim().toUpperCase();
    page = 0;
    void load();
  });

  void load();
}
