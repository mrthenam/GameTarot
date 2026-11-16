// Quà & tỉ lệ: table of prizes, edit drawer, rate summary, active switches.
import { api, type AdminState, type Prize, type Rarity } from '../api';
import { confirmDialog, esc, fmt, icon, openDrawer, PRIZE_ICONS, prizeIconUrl, RARITY, rarityBadge, toast } from '../ui';
import type { Ctx } from '../main';

const blank = (): Prize => ({
  id: '', name: '', desc: '', icon: 'giftbox', rarity: 'common', rate: 0, quantity: null, dailyLimit: null,
  won: 0, wonToday: 0, voucher: true, extraTurns: 0, active: true, fallback: false,
});

const activeSum = (list: Prize[]) => list.filter((p) => p.active).reduce((s, p) => s + p.rate, 0);

function newId(list: Prize[]) {
  const used = new Set(list.map((p) => p.id));
  let id = '';
  do id = `qua-${Math.random().toString(36).slice(2, 6)}`;
  while (used.has(id));
  return id;
}

export function renderPrizes(view: HTMLElement, ctx: Ctx) {
  const draw = () => {
    const prizes = ctx.state.prizes;
    const sum = activeSum(prizes);
    const rest = 100 - sum;
    const fb = prizes.find((p) => p.fallback);
    view.innerHTML = `
      <section class="card">
        <div class="card-body">
          <div class="rate-sum">
            <div>
              <div class="kpi-label">Tổng tỉ lệ quà đang phát</div>
              <div class="kpi-value" style="margin:2px 0 0">${fmt(sum, 2)}%</div>
            </div>
            <div class="bar ${sum > 100.0001 ? 'over' : ''}" role="img" aria-label="Tổng tỉ lệ ${fmt(sum, 2)} trên 100%"><i style="width:${Math.min(100, sum)}%"></i></div>
            <div class="hint" style="max-width:420px">${rest > 0.0001
              ? `Phần còn lại <b>${fmt(rest, 2)}%</b> thuộc về quà dự phòng${fb ? ` “${esc(fb.name)}”` : ''}.`
              : rest < -0.0001 ? '<span style="color:var(--danger)">Tổng đang vượt 100%.</span>' : 'Đã đủ 100%.'}
              Món hết số giải, đủ số trong ngày hoặc tạm ngừng sẽ nhường phần của nó cho quà dự phòng.</div>
          </div>
        </div>
      </section>

      <section class="card" style="margin-top:20px">
        <div class="card-head">
          <h2>Danh sách quà <small>${prizes.length} món · ${prizes.filter((p) => p.active).length} đang phát</small></h2>
        </div>
        <div class="card-body flush">
          <div class="table-wrap"><table class="table stack-sm">
            <thead><tr>
              <th>Món quà</th><th>Độ hiếm</th><th>Tỉ lệ trúng</th><th>Số giải</th><th>Loại</th><th>Đang phát</th><th class="right">Thao tác</th>
            </tr></thead>
            <tbody>${prizes.map((p, i) => row(p, i)).join('')}</tbody>
          </table></div>
        </div>
        <div class="card-foot">
          <span>${icon('alert', 14)} Tỉ lệ là xác suất trúng của mỗi lượt bốc. Đặt "Số giải" để giới hạn tổng số quà phát ra.</span>
        </div>
      </section>`;
  };

  const row = (p: Prize, i: number) => {
    const out = p.quantity !== null && p.won >= p.quantity;
    const capped = p.dailyLimit !== null && (p.wonToday ?? 0) >= p.dailyLimit;
    const left = p.quantity === null ? null : Math.max(0, p.quantity - p.won);
    const ratio = p.quantity ? (left ?? 0) / p.quantity : 1;
    const tags = [
      p.fallback ? `<span class="badge b-primary">${icon('shield', 13)}Dự phòng</span>` : '',
      p.voucher ? `<span class="badge b-muted">${icon('ticket', 13)}Mã quà</span>` : '',
      p.extraTurns ? `<span class="badge b-muted">+${p.extraTurns} lượt</span>` : '',
    ].join('');
    return `<tr class="${p.active ? '' : 'off'}" data-i="${i}">
      <td class="cell-main"><div class="prize-cell">
        <div class="prize-thumb"><img src="${prizeIconUrl(p.icon)}" alt=""></div>
        <div style="min-width:0"><b>${esc(p.name)}</b><small>${esc(p.desc) || '&nbsp;'}</small></div>
      </div></td>
      <td data-label="Độ hiếm">${rarityBadge(p.rarity)}</td>
      <td data-label="Tỉ lệ trúng"><div class="rate-cell"><b>${fmt(p.rate, 2)}%</b><div class="hint">≈ ${fmt(p.rate * 10, 1)}/1.000 lượt</div></div></td>
      <td data-label="Số giải"><div class="stock">
        ${left === null ? `<div class="stock-line"><span>Đã trúng <b class="num">${fmt(p.won)}</b></span><span class="muted">không giới hạn</span></div>`
          : `<div class="stock-line"><span>Còn <b class="num">${fmt(left)}</b> / ${fmt(p.quantity ?? 0)}</span>${out ? '<span class="badge b-danger">Hết</span>' : ratio <= 0.1 ? '<span class="badge b-warning">Sắp hết</span>' : ''}</div>
             <div class="bar ${ratio <= 0.1 ? 'low' : ''}"><i style="width:${ratio * 100}%"></i></div>`}
        <div class="stock-sub">Hôm nay <b class="num">${fmt(p.wonToday ?? 0)}</b>${p.dailyLimit !== null ? ` / ${fmt(p.dailyLimit)}` : ''}${capped ? ' · <span style="color:var(--warning)">đủ số hôm nay</span>' : ''}</div>
      </div></td>
      <td data-label="Loại"><div class="tags">${tags || '<span class="muted">—</span>'}</div></td>
      <td data-label="Đang phát"><label class="switch" title="${p.fallback ? 'Quà dự phòng luôn bật' : 'Bật/tắt phát món này'}">
        <input type="checkbox" data-act="toggle" ${p.active ? 'checked' : ''} ${p.fallback ? 'disabled' : ''} aria-label="Đang phát ${esc(p.name)}"><i></i></label></td>
      <td><div class="row-actions">
        <button class="icon-btn sm" data-act="edit" title="Sửa" aria-label="Sửa ${esc(p.name)}">${icon('edit', 16)}</button>
        <button class="icon-btn sm danger" data-act="delete" title="Xóa" aria-label="Xóa ${esc(p.name)}">${icon('trash', 16)}</button>
      </div></td>
    </tr>`;
  };

  /** Save the whole list; on success the page re-renders from the server's answer. */
  const save = async (list: Prize[], ok: string) => {
    const s = await api<AdminState>('PUT', '/admin/prizes', { prizes: list });
    ctx.setState(s);
    draw();
    toast(ok);
  };

  const edit = (index: number | null) => {
    const list = ctx.state.prizes;
    const p: Prize = index === null ? { ...blank(), id: newId(list) } : { ...list[index] };
    const otherSum = activeSum(list.filter((_, j) => j !== index));
    const icons = Object.entries(PRIZE_ICONS).map(([k, label]) => `
      <label title="${label}"><input type="radio" name="icon" value="${k}" ${k === p.icon ? 'checked' : ''} aria-label="${label}"><span><img src="${prizeIconUrl(k)}" alt=""></span></label>`).join('');
    const rarities = (Object.keys(RARITY) as Rarity[]).map((k) => `<option value="${k}" ${k === p.rarity ? 'selected' : ''}>${RARITY[k]}</option>`).join('');
    const d = openDrawer(index === null ? 'Thêm món quà' : 'Sửa món quà', `
      <form id="prize-form" class="form-grid" novalidate>
        <div class="field span-2"><label for="f-name">Tên món quà <span class="req">*</span></label>
          <input class="input" id="f-name" name="name" value="${esc(p.name)}" placeholder="VD: Voucher giảm 10%" required></div>
        <div class="field span-2"><label for="f-desc">Mô tả cho khách</label>
          <textarea class="textarea" id="f-desc" name="desc" placeholder="Hiện trên thẻ quà khi khách trúng">${esc(p.desc)}</textarea></div>
        <div class="field span-2"><span class="label">Biểu tượng</span><div class="icon-pick">${icons}</div></div>
        <div class="field"><label for="f-rarity">Độ hiếm</label><select class="select" id="f-rarity" name="rarity">${rarities}</select>
          <span class="hint">Quyết định màu phong ấn và hiệu ứng khi mở bài.</span></div>
        <div class="field"><label for="f-rate">Tỉ lệ trúng</label>
          <div class="input-group"><input class="input num" id="f-rate" name="rate" type="number" min="0" max="100" step="0.01" value="${p.rate}"><span class="suffix">%</span></div>
          <span class="hint" id="rate-hint"></span></div>
        <div class="section-title span-2">Số lượng</div>
        <div class="field"><label for="f-qty">Tổng số giải</label>
          <input class="input num" id="f-qty" name="quantity" type="number" min="0" step="1" value="${p.quantity ?? ''}" placeholder="Không giới hạn">
          <span class="hint">${p.won ? `Đã trúng ${fmt(p.won)}.` : 'Để trống nếu không giới hạn.'}</span></div>
        <div class="field"><label for="f-daily">Tối đa mỗi ngày</label>
          <input class="input num" id="f-daily" name="dailyLimit" type="number" min="1" step="1" value="${p.dailyLimit ?? ''}" placeholder="Không giới hạn"></div>
        <div class="field"><label for="f-extra">Cộng thêm lượt bốc</label>
          <input class="input num" id="f-extra" name="extraTurns" type="number" min="0" max="5" step="1" value="${p.extraTurns}"></div>
        <div class="section-title span-2">Tùy chọn</div>
        <div class="span-2">
          <div class="switch-row"><div><b>Phát mã quà</b><span class="hint">Sinh mã để khách đưa nhân viên đổi quà tại quầy.</span></div>
            <label class="switch"><input type="checkbox" name="voucher" ${p.voucher ? 'checked' : ''} aria-label="Phát mã quà"><i></i></label></div>
          <div class="switch-row"><div><b>Quà dự phòng</b><span class="hint">Nhận phần tỉ lệ còn lại và phần của các món đã hết. Luôn bật, không giới hạn.</span></div>
            <label class="switch"><input type="checkbox" name="fallback" ${p.fallback ? 'checked' : ''} ${p.fallback ? 'disabled' : ''} aria-label="Quà dự phòng"><i></i></label></div>
          <div class="switch-row"><div><b>Đang phát</b><span class="hint">Tắt để tạm ngừng phát món này.</span></div>
            <label class="switch"><input type="checkbox" name="active" ${p.active ? 'checked' : ''} aria-label="Đang phát"><i></i></label></div>
        </div>
        <div class="span-2" id="form-error"></div>
      </form>`,
      `<button class="btn" data-x="close">Hủy</button><button class="btn primary" id="save-prize">${icon('check', 16)}${index === null ? 'Thêm món quà' : 'Lưu thay đổi'}</button>`);

    const form = d.body.querySelector<HTMLFormElement>('#prize-form')!;
    const el = <T extends HTMLElement>(sel: string) => form.querySelector<T>(sel)!;
    const sync = () => {
      const fb = el<HTMLInputElement>('[name=fallback]').checked;
      el<HTMLInputElement>('#f-qty').disabled = fb;
      el<HTMLInputElement>('#f-daily').disabled = fb;
      el<HTMLInputElement>('[name=active]').disabled = fb;
      if (fb) el<HTMLInputElement>('[name=active]').checked = true;
      const active = el<HTMLInputElement>('[name=active]').checked;
      const rate = Number(el<HTMLInputElement>('#f-rate').value) || 0;
      const total = otherSum + (active ? rate : 0);
      el('#rate-hint').innerHTML = total > 100.0001
        ? `<span style="color:var(--danger)">Tổng sẽ là ${fmt(total, 2)}%, vượt 100%.</span>`
        : `Tổng các món đang phát: ${fmt(total, 2)}%. Tối đa còn ${fmt(Math.max(0, 100 - otherSum), 2)}%.`;
    };
    form.addEventListener('input', sync);
    sync();
    el<HTMLInputElement>('#f-name').focus();

    d.el.querySelector('#save-prize')!.addEventListener('click', async () => {
      const fd = new FormData(form);
      const num = (k: string) => {
        const v = String(fd.get(k) ?? '').trim();
        return v === '' ? null : Number(v);
      };
      const fb = el<HTMLInputElement>('[name=fallback]').checked;
      const next: Prize = {
        ...p,
        name: String(fd.get('name') ?? '').trim(),
        desc: String(fd.get('desc') ?? '').trim(),
        icon: String(fd.get('icon') ?? p.icon),
        rarity: String(fd.get('rarity')) as Rarity,
        rate: Number(fd.get('rate')) || 0,
        quantity: fb ? null : num('quantity'),
        dailyLimit: fb ? null : num('dailyLimit'),
        extraTurns: Number(fd.get('extraTurns')) || 0,
        voucher: el<HTMLInputElement>('[name=voucher]').checked,
        fallback: fb,
        active: fb || el<HTMLInputElement>('[name=active]').checked,
      };
      const errBox = el('#form-error');
      if (!next.name) {
        errBox.innerHTML = `<div class="form-error">${icon('alert', 16)}<span>Hãy nhập tên món quà.</span></div>`;
        el<HTMLInputElement>('#f-name').focus();
        return;
      }
      let list = ctx.state.prizes.map((x) => ({ ...x }));
      if (next.fallback) list = list.map((x) => ({ ...x, fallback: false }));
      if (index === null) list.push(next);
      else list[index] = next;
      const btn = d.el.querySelector<HTMLButtonElement>('#save-prize')!;
      btn.disabled = true;
      try {
        await save(list, index === null ? `Đã thêm “${next.name}”` : `Đã lưu “${next.name}”`);
        d.close();
      } catch (e) {
        errBox.innerHTML = `<div class="form-error">${icon('alert', 16)}<span>${esc((e as Error).message)}</span></div>`;
        btn.disabled = false;
      }
    });
  };

  view.addEventListener('click', async (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    const tr = t.closest<HTMLElement>('tr[data-i]');
    const i = tr ? Number(tr.dataset.i) : -1;
    const p = ctx.state.prizes[i];
    if (t.dataset.act === 'edit') edit(i);
    else if (t.dataset.act === 'delete' && p) {
      if (p.fallback) return toast('Hãy chọn món khác làm quà dự phòng trước khi xóa món này.', 'error');
      const ok = await confirmDialog({ title: 'Xóa món quà?', body: `“${esc(p.name)}” sẽ bị xóa khỏi danh sách. Các mã quà đã phát cho món này vẫn được giữ để đổi.`, ok: 'Xóa', danger: true });
      if (!ok) return;
      try {
        await save(ctx.state.prizes.filter((_, j) => j !== i), `Đã xóa “${p.name}”`);
      } catch (ex) {
        toast((ex as Error).message, 'error');
      }
    }
  });
  view.addEventListener('change', async (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.act !== 'toggle') return;
    const i = Number(t.closest<HTMLElement>('tr')!.dataset.i);
    const list = ctx.state.prizes.map((x, j) => (j === i ? { ...x, active: t.checked } : { ...x }));
    try {
      await save(list, t.checked ? `Đã bật “${list[i].name}”` : `Đã tạm ngừng “${list[i].name}”`);
    } catch (ex) {
      t.checked = !t.checked;
      toast((ex as Error).message, 'error');
    }
  });

  draw();
  return {
    add: () => edit(null),
    resetWon: async () => {
      const ok = await confirmDialog({
        title: 'Đặt lại số đã trúng?',
        body: 'Số “Đã trúng” của mọi món về 0, dùng khi bắt đầu đợt khuyến mại mới. Lịch sử mã quà vẫn được giữ.',
        ok: 'Đặt lại', tone: 'warning',
      });
      if (!ok) return;
      try {
        ctx.setState(await api<AdminState>('POST', '/admin/reset-won'));
        draw();
        toast('Đã đặt lại số đã trúng');
      } catch (ex) {
        toast((ex as Error).message, 'error');
      }
    },
  };
}
