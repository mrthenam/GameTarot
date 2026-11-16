// Cài đặt: shop & play settings, password.
import { api, type AdminState } from '../api';
import { esc, icon, toast } from '../ui';
import type { Ctx } from '../main';

export function renderSettings(view: HTMLElement, ctx: Ctx) {
  const s = ctx.state.settings;
  view.innerHTML = `
    <div class="grid g-2-1">
      <section class="card">
        <div class="card-head"><h2>Cửa hàng &amp; lượt chơi</h2></div>
        <form id="settings" class="card-body">
          <div class="form-grid">
            <div class="field"><label for="s-shop">Tên cửa hàng</label><input class="input" id="s-shop" name="shopName" value="${esc(s.shopName)}"></div>
            <div class="field"><label for="s-title">Tên game <span class="req">*</span></label><input class="input" id="s-title" name="gameTitle" value="${esc(s.gameTitle)}" required></div>
            <div class="field span-2"><label for="s-sub">Câu giới thiệu</label><input class="input" id="s-sub" name="subtitle" value="${esc(s.subtitle)}"></div>
            <div class="field"><label for="s-turns">Lượt bốc mỗi ngày</label><input class="input num" id="s-turns" name="turnsPerDay" type="number" min="1" max="99" value="${s.turnsPerDay}">
              <span class="hint">Hồi lại lúc 0 giờ mỗi ngày.</span></div>
            <div class="field"><label for="s-pity">Bảo đảm quà Hiếm sau</label>
              <div class="input-group"><input class="input num" id="s-pity" name="pityEvery" type="number" min="0" max="50" value="${s.pityEvery}"><span class="suffix" style="min-width:56px">lượt</span></div>
              <span class="hint">Số lượt liên tiếp chỉ trúng quà Thường. 0 là tắt.</span></div>
            <div class="field"><label for="s-days">Hạn dùng mã quà</label>
              <div class="input-group"><input class="input num" id="s-days" name="voucherDays" type="number" min="0" max="365" value="${s.voucherDays}"><span class="suffix" style="min-width:56px">ngày</span></div>
              <span class="hint">0 là không hết hạn.</span></div>
            <div class="field"><label for="s-prefix">Tiền tố mã</label><input class="input mono" id="s-prefix" name="codePrefix" value="${esc(s.codePrefix)}" maxlength="10" style="text-transform:uppercase">
              <span class="hint">Mã có dạng ${esc(s.codePrefix)}-7KQ2XM.</span></div>
            <div class="field span-2"><label for="s-note">Lời dặn khi đổi quà</label><textarea class="textarea" id="s-note" name="redeemNote">${esc(s.redeemNote)}</textarea></div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:20px"><button class="btn primary" type="submit">${icon('check', 16)}Lưu cài đặt</button></div>
        </form>
      </section>

      <div class="stack">
        <section class="card">
          <div class="card-head"><h2>Đổi mật khẩu</h2></div>
          ${ctx.state.passwordFromEnv
            ? `<div class="card-body"><div class="empty" style="padding:12px 0"><div class="kpi-icon tone-info">${icon('lock', 22)}</div><span>Mật khẩu đang được đặt bằng biến môi trường <code>ADMIN_PASSWORD</code> trên máy chủ.</span></div></div>`
            : `<form id="password" class="card-body" style="display:grid;gap:14px">
                <div class="field"><label for="p-cur">Mật khẩu hiện tại</label><input class="input" id="p-cur" type="password" name="current" autocomplete="current-password" required></div>
                <div class="field"><label for="p-new">Mật khẩu mới</label><input class="input" id="p-new" type="password" name="next" autocomplete="new-password" minlength="6" required><span class="hint">Ít nhất 6 ký tự.</span></div>
                <div class="field"><label for="p-again">Nhập lại mật khẩu mới</label><input class="input" id="p-again" type="password" name="again" autocomplete="new-password" minlength="6" required></div>
                <button class="btn" type="submit">${icon('key', 16)}Đổi mật khẩu</button>
              </form>`}
        </section>
        <section class="card">
          <div class="card-head"><h2>Phiên đăng nhập</h2></div>
          <div class="card-body" style="display:grid;gap:10px">
            <div class="info-line">${icon('clock', 16)}<span>Phiên tự hết hạn sau 12 giờ.</span></div>
            <div class="info-line">${icon('shield', 16)}<span>Đăng nhập sai nhiều lần liên tiếp sẽ bị chặn vài phút.</span></div>
          </div>
        </section>
      </div>
    </div>`;

  view.querySelector('#settings')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    const v = Object.fromEntries(new FormData(f).entries()) as Record<string, string>;
    try {
      ctx.setState(await api<AdminState>('PUT', '/admin/settings', {
        settings: { ...v, codePrefix: v.codePrefix.trim().toUpperCase(), turnsPerDay: Number(v.turnsPerDay), pityEvery: Number(v.pityEvery), voucherDays: Number(v.voucherDays) },
      }));
      toast('Đã lưu cài đặt');
      ctx.refreshShell();
      renderSettings(view, ctx);
    } catch (ex) {
      toast((ex as Error).message, 'error');
    }
  });
  view.querySelector('#password')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    const fd = new FormData(f);
    if (fd.get('next') !== fd.get('again')) return toast('Hai lần nhập mật khẩu mới không khớp.', 'error');
    try {
      await api('POST', '/admin/password', { current: fd.get('current'), next: fd.get('next') });
      f.reset();
      toast('Đã đổi mật khẩu');
    } catch (ex) {
      toast((ex as Error).message, 'error');
    }
  });
}
