// Tổng quan: KPIs, draws per day, prizes won, stock left, latest codes.
import { api, type Draw, type Stats } from '../api';
import { columnChart, columnTable, hbars, type Column } from '../charts';
import { codeStatus, dayLabel, esc, fmt, icon, pct, prizeIconUrl, when } from '../ui';
import type { Ctx } from '../main';

const DAYS = 14;

/** Today so far against yesterday up to the same time of day. */
function trend(today: number, before: number) {
  if (before === 0) return today === 0 ? 'Chưa có lượt nào hôm nay' : 'Hôm qua giờ này chưa có lượt nào';
  const d = ((today - before) / before) * 100;
  if (Math.abs(d) < 0.05) return '<span class="trend flat">bằng</span>cùng giờ hôm qua';
  return `<span class="trend ${d > 0 ? 'up' : 'down'}">${icon(d > 0 ? 'up' : 'down', 13)}${fmt(Math.abs(d), 1)}%</span>so với cùng giờ hôm qua`;
}

export async function renderOverview(view: HTMLElement, ctx: Ctx): Promise<() => void> {
  const [stats, recent] = await Promise.all([
    api<Stats>('GET', `/admin/stats?days=${DAYS}`),
    api<{ draws: Draw[] }>('GET', '/admin/draws?limit=6'),
  ]);
  const t = stats.totals;
  const redeemRate = t.codes ? (t.redeemed / t.codes) * 100 : 0;
  const prizes = ctx.state.prizes;
  const limited = prizes.filter((p) => p.quantity !== null);
  const rangeDraws = stats.days.reduce((s, d) => s + d.draws, 0);
  const rangeCodes = stats.days.reduce((s, d) => s + d.codes, 0);
  const rangeRedeemed = stats.days.reduce((s, d) => s + d.redeemed, 0);
  const cols: Column[] = stats.days.map((d) => ({
    label: dayLabel(d.day),
    title: dayLabel(d.day, true),
    value: d.draws,
    rows: [['Lượt bốc', fmt(d.draws)], ['Mã quà phát ra', fmt(d.codes)], ['Mã đã đổi', fmt(d.redeemed)]],
  }));
  const rarityOf = new Map(prizes.map((p) => [p.id, p.rarity]));

  view.innerHTML = `
    <div class="grid g-4">
      <div class="card kpi">
        <div class="kpi-body">
          <div class="kpi-label">Lượt bốc hôm nay</div>
          <div class="kpi-value">${fmt(t.drawsToday)}</div>
          <div class="kpi-meta">${trend(t.drawsToday, t.drawsYesterdaySoFar)}</div>
        </div>
        <div class="kpi-icon tone-primary">${icon('dice', 22)}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-body">
          <div class="kpi-label">Mã quà phát hôm nay</div>
          <div class="kpi-value">${fmt(t.codesToday)}</div>
          <div class="kpi-meta">Tổng <b class="num">${fmt(t.codes)}</b> mã, <b class="num">${fmt(t.active)}</b> còn hiệu lực</div>
        </div>
        <div class="kpi-icon tone-info">${icon('ticket', 22)}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-body">
          <div class="kpi-label">Tỉ lệ đổi quà</div>
          <div class="kpi-value">${t.codes ? pct(redeemRate) : '—'}</div>
          <div class="kpi-meta"><b class="num">${fmt(t.redeemed)}</b> mã đã đổi tại quầy${t.expired ? `, <b class="num">${fmt(t.expired)}</b> hết hạn` : ''}</div>
        </div>
        <div class="kpi-icon tone-success">${icon('ticketCheck', 22)}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-body">
          <div class="kpi-label">Người chơi</div>
          <div class="kpi-value">${fmt(t.players)}</div>
          <div class="kpi-meta"><b class="num">${fmt(t.playersToday)}</b> người chơi hôm nay</div>
        </div>
        <div class="kpi-icon tone-warning">${icon('users', 22)}</div>
      </div>
    </div>

    <div class="grid g-3-1" style="margin-top:20px">
      <section class="card">
        <div class="card-head">
          <h2>Lượt bốc theo ngày <small>${DAYS} ngày gần nhất</small></h2>
          <div class="seg" role="tablist" aria-label="Kiểu hiển thị">
            <button class="on" data-view="chart" aria-pressed="true">${icon('chart', 15)}Biểu đồ</button>
            <button data-view="table" aria-pressed="false">${icon('table', 15)}Bảng</button>
          </div>
        </div>
        <div class="card-body">
          <div class="chart-sum">
            <div><b>${fmt(rangeDraws)}</b>Lượt bốc</div>
            <div><b>${fmt(rangeCodes)}</b>Mã quà phát ra</div>
            <div><b>${fmt(rangeRedeemed)}</b>Mã đã đổi</div>
          </div>
          <div id="daily-chart"></div>
          <div id="daily-table" hidden>${columnTable(cols, ['Ngày', 'Lượt bốc', 'Mã phát ra', 'Đã đổi'])}</div>
        </div>
      </section>

      <section class="card" style="display:flex;flex-direction:column">
        <div class="card-head"><h2>Kho quà</h2><a href="#/qua" class="btn sm">Quản lý</a></div>
        <div class="card-body">
          ${limited.length ? `<div class="hbars">${limited.map((p) => {
            const left = Math.max(0, (p.quantity ?? 0) - p.won);
            const ratio = p.quantity ? left / p.quantity : 0;
            const low = ratio <= 0.1;
            return `<div class="hbar">
              <div class="hbar-name"><span class="dot ${p.rarity}"></span><span>${esc(p.name)}</span></div>
              <div class="hbar-val">${left === 0 ? `<span class="badge b-danger">${icon('fail', 13)}Hết quà</span>` : low ? `<span class="badge b-warning">${icon('warn', 13)}Sắp hết</span> ` : ''}<b>${fmt(left)}</b> / ${fmt(p.quantity ?? 0)}</div>
              <div class="bar ${low ? 'low' : ''}" style="grid-column:1/-1"><i style="width:${ratio * 100}%"></i></div>
            </div>`;
          }).join('')}</div>`
          : `<div class="empty"><div class="kpi-icon tone-primary">${icon('package', 22)}</div><b>Chưa giới hạn số giải</b><span>Mọi món quà đang phát không giới hạn. Đặt "Tổng số giải" trong trang Quà &amp; tỉ lệ để theo dõi tồn kho ở đây.</span></div>`}
        </div>
        ${limited.length ? `<div class="card-foot" style="margin-top:auto">${(() => {
          const out = limited.filter((p) => p.won >= (p.quantity ?? 0)).length;
          const low = limited.filter((p) => p.won < (p.quantity ?? 0) && ((p.quantity ?? 0) - p.won) / (p.quantity || 1) <= 0.1).length;
          const free = prizes.length - limited.length;
          return `<span>${fmt(limited.length)} món có giới hạn${out ? `, <b style="color:var(--danger)">${fmt(out)} hết quà</b>` : ''}${low ? `, <b style="color:var(--warning)">${fmt(low)} sắp hết</b>` : ''}</span><span>${fmt(free)} món không giới hạn</span>`;
        })()}</div>` : ''}
      </section>
    </div>

    <div class="grid g-1-1" style="margin-top:20px">
      <section class="card">
        <div class="card-head"><h2>Quà đã trúng <small>${DAYS} ngày gần nhất</small></h2></div>
        <div class="card-body">
          ${stats.byPrize.length
            ? hbars(stats.byPrize.map((b) => ({ name: b.name, dot: rarityOf.get(b.id) ?? b.rarity, value: b.count })), 'lần')
            : `<div class="empty"><div class="kpi-icon tone-primary">${icon('gift', 22)}</div><b>Chưa có ai bốc quà</b><span>Số liệu sẽ hiện ở đây khi khách bắt đầu chơi.</span></div>`}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Mã quà mới nhất</h2><a href="#/ma-qua" class="btn sm">Xem tất cả</a></div>
        <div class="card-body flush">
          ${recent.draws.length ? `<div class="table-wrap"><table class="table stack-sm">
            <thead><tr><th>Mã quà</th><th>Món quà</th><th>Lúc trúng</th><th>Trạng thái</th></tr></thead>
            <tbody>${recent.draws.map((d) => `<tr>
              <td class="cell-main mono"><b>${esc(d.code)}</b></td>
              <td data-label="Món quà"><span style="display:inline-flex;align-items:center;gap:8px"><img src="${prizeIconUrl(prizes.find((p) => p.id === d.prizeId)?.icon ?? 'giftbox')}" alt="" width="22" height="22">${esc(d.prizeName)}</span></td>
              <td data-label="Lúc trúng" class="muted num">${when(d.at)}</td>
              <td data-label="Trạng thái">${codeStatus(d).html}</td>
            </tr>`).join('')}</tbody></table></div>`
          : `<div class="empty"><div class="kpi-icon tone-info">${icon('inbox', 22)}</div><b>Chưa có mã quà nào</b><span>Mã được phát khi khách trúng món có mã voucher.</span></div>`}
        </div>
      </section>
    </div>`;

  const chartHost = view.querySelector<HTMLElement>('#daily-chart')!;
  const stop = columnChart(chartHost, cols, `Số lượt bốc mỗi ngày trong ${DAYS} ngày gần nhất, tổng ${rangeDraws} lượt`);
  view.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) =>
    b.addEventListener('click', () => {
      const table = b.dataset.view === 'table';
      view.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      chartHost.hidden = table;
      view.querySelector<HTMLElement>('#daily-table')!.hidden = !table;
    }),
  );
  return stop;
}
