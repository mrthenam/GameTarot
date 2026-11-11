# Căn Phòng Tarot

Game web 3D (three.js + Vite + TypeScript). Người chơi bước qua cánh cửa ma thuật vào phòng của cô phù thủy, chọn 1 trong 11 lá bài đang bay lơ lửng (theo số lượt còn lại), phá 3 tầng phong ấn để mở lá bài và nhận **thông điệp** từ 22 lá Ẩn Chính kèm **một món quà thật/voucher** do cửa hàng cấu hình.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173 (mở được trong mạng LAN)
npm run build      # bản phát hành → dist/ (đưa nguyên thư mục lên hosting tĩnh)
```

Tham số thử nghiệm, chỉ có tác dụng khi chạy `npm run dev` (bản build sẽ bỏ qua): `?turns=99` để đặt số lượt, `?reset` để xóa dữ liệu đã lưu.

## Cấu hình cho cửa hàng: `public/config.json` (sau khi build là `dist/config.json`)

| Trường | Ý nghĩa |
|---|---|
| `gameTitle`, `subtitle`, `shopName` | Tên game, câu giới thiệu, tên cửa hàng ở màn mở đầu |
| `turnsPerDay` | Số lượt bốc mỗi ngày (hồi lại lúc 0h theo giờ máy người chơi) |
| `pityEvery` | Sau N lần liên tiếp chỉ trúng quà *Thường*, lần sau chắc chắn từ *Hiếm* trở lên (0 = tắt) |
| `voucherDays` | Hạn dùng mã quà, tính bằng ngày |
| `codePrefix`, `redeemNote` | Tiền tố mã quà (VD `TAROT-7KQ2XM`) và lời dặn khi đổi quà |
| `prizes[]` | Danh sách quà. Mỗi món gồm `name`, `desc`, `icon`, `rarity`, `weight`, `voucher`, `extraTurns` |

- `rarity`: `common` (Thường) · `rare` (Hiếm) · `epic` (Sử Thi) · `legendary` (Huyền Thoại). Độ hiếm quyết định màu phong ấn khi mở bài và độ hoành tráng của hiệu ứng.
- `weight`: tỉ lệ tương đối. Ví dụ tổng trọng số 100 thì `weight: 1` nghĩa là xác suất 1%.
- `icon`: `star`, `hourglass`, `ticket`, `giftbox`, `tea`, `envelope`, `crown`, `cake`, `crystal`.
- `voucher: true` sẽ sinh mã quà và lưu vào **Túi quà**. Đặt `extraTurns: 1` để món quà cộng thêm lượt bốc.

Sửa file này không cần build lại, chỉ cần tải lại trang.

> **Lưu ý:** game chạy hoàn toàn trên trình duyệt. Lượt chơi và mã quà lưu trong `localStorage` của máy người chơi, nên người rành kỹ thuật có thể xóa dữ liệu để chơi lại, và mã quà không được kiểm tra với máy chủ. Nhân viên nên kiểm tra mã ngay trên màn hình *Túi quà* của khách. Nếu cần chống gian lận hoặc giới hạn số lượng quà thật, phải có thêm backend.

## Đã làm

- Cảnh mở đầu: cánh cửa khắc rune có đuốc hai bên, bấm "Bước vào phòng" thì cửa mở và camera lướt vào phòng.
- Căn phòng 3D: tranh nền (cửa sổ trăng tròn), bàn khăn nhung, nến lập lòe có ánh sáng, quả cầu pha lê, bụi ma thuật, bloom.
- Phù thủy: ảnh vẽ có thở và đung đưa; khi làm phép thì mắt và tay phát sáng. Bong bóng thoại tiếng Việt theo từng tình huống.
- Quạt 11 lá bài bay lơ lửng: nâng lên khi rê chuột (trên điện thoại chạm lần 1 để nâng, lần 2 để chọn). Hoạt ảnh xáo và chia bài từ tay phù thủy.
- Chuỗi mở bài hồi hộp:
  1. Lá bài bay tới trước mặt người chơi, vòng tròn ma thuật hiện ra, nhịp tim dồn dập.
  2. **3 tầng phong ấn** phải chạm để phá. Mỗi tầng vỡ lộ dần màu độ hiếm và có thể "nâng cấp" (Xanh → Tím → Hồng → Vàng), tầng cuối có màu chập chờn trước khi chốt.
  3. Lá bài rung mạnh, rồi lật kèm chớp sáng, tia sáng và pháo hạt.
  4. Món quà trồi lên từ sau lá bài.
- Bảng kết quả: độ hiếm, tên lá bài (Việt/Anh), từ khóa, thông điệp gõ dần, món quà, mã voucher (chạm để sao chép), hạn dùng.
- Vòng lặp giữ chân người chơi: lượt theo ngày với đồng hồ đếm ngược, quà "+1 lượt", thanh *Năng lượng vũ trụ* (bảo đảm quà Hiếm), *Bộ sưu tập* 22 lá (ưu tiên ra lá chưa có), *Túi quà*.
- Âm thanh tự tổng hợp bằng WebAudio: nhạc nền huyền bí (Rê thứ, harp/pad/celesta), tiếng vỡ phong ấn, nhịp tim, riser, lật bài, quà. Có nút tắt tiếng.
- Bố cục dọc cho điện thoại (bảng kết quả dạng sheet dưới, nút "Bốc tiếp" luôn hiện) và bố cục ngang cho máy tính.

## Còn lại / gợi ý

- Giọng nói và nhạc do AI tạo chưa làm được, vì khóa `GOOGLE_API_KEY` hiện tại không có quyền dùng Lyria (nhạc) hay Gemini TTS (giọng). Hiện tại âm thanh được tổng hợp bằng code và lời phù thủy hiện bằng chữ.
- Backend để kiểm tra mã quà và giới hạn số lượng quà thật (xem lưu ý ở trên).
- Có thể thêm: chia sẻ lá bài lên mạng xã hội để nhận thêm lượt, phần thưởng khi hoàn thành bộ 22 lá.

## Quay video kiểm tra

Khi `npm run dev` đang chạy:

```bash
node scripts/capture.mjs shots              # ảnh các khoảnh khắc chính → screenshots/shots
node scripts/capture.mjs video --rarity legendary   # video ~19 s → screenshots/proof.mp4
```

Script dùng Chrome thật có GPU, bước thời gian cố định 1/30 s (`?capture=1`).

## Tài nguyên

Ảnh gốc độ phân giải cao nằm trong `asset_src/` (không đưa vào git). Bản WebP dùng trong game nằm trong `src/assets/`.

| Tên | Mô tả | Kích thước trong game | Đường dẫn | Chi phí |
|---|---|---|---|---|
| 22 lá Ẩn Chính | Gouache + vàng lá, khung vàng thống nhất (tạo từ lá The Fool làm mẫu). Tên tiếng Việt vẽ đè lúc chạy | Lá 0.30×0.447 m; khi mở cao ~60% màn hình | `src/assets/cards/00–21.webp` (720×1073) | 22 × 7¢ = 1,54 $ |
| Mặt sau lá bài | Con mắt trong trăng và mặt trời | như trên | `src/assets/cards/back.webp` | 7¢ |
| Phù thủy | Áo choàng tím, nửa người, đã tách nền | Billboard cao 1,62 m | `src/assets/img/witch.webp` (1020×1300) | 10¢ |
| Căn phòng | Tranh nền cửa sổ trăng, kệ sách, nến | 2048×1143, phủ kín khung nhìn, đặt ở z = −3,4 m | `src/assets/img/room.webp` | 10¢ |
| Cánh cửa | Cửa đôi gỗ mun khắc rune | 2,0×3,0 m, chia 2 cánh | `src/assets/img/door.webp` (848×1264) | 7¢ |
| Icon quà (9) | star, hourglass, ticket, giftbox, tea, envelope, crown, cake, crystal (đã tách nền) | 72 px trong bảng; ~0,14 m trong cảnh | `src/assets/icons/*.webp` (384×384) | 10¢ |
| Âm thanh | Nhạc nền và hiệu ứng tổng hợp bằng WebAudio | vòng lặp 8 ô nhịp, 72 BPM | `src/audio/audio.ts` | 0 |
| Texture thủ tục | Phong ấn, vòng ma thuật, tia sáng, khăn nhung, tường đá | — | `src/scene/textures.ts` | 0 |

**Tổng chi phí tạo tài nguyên: 1,98 $.**
