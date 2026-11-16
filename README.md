# Tarot Ánh Trăng

Game web 3D (three.js + Vite + TypeScript). Người chơi bước qua cánh cửa ma thuật vào phòng của cô phù thủy, chọn 1 trong 11 lá bài đang bay lơ lửng (theo số lượt còn lại), phá 3 tầng phong ấn để mở lá bài và nhận **thông điệp** từ 22 lá Ẩn Chính kèm **một món quà thật/voucher** do cửa hàng cấu hình.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173: game + máy chủ quà, admin ở /admin.html
npm run build      # bản phát hành → dist/
npm start          # chạy bản phát hành kèm máy chủ quà: http://localhost:8787, admin ở /admin.html
```

- Cần Node 22.13 trở lên, vì máy chủ dùng SQLite có sẵn trong Node (`node:sqlite`).
- `npm start` đọc biến môi trường `PORT` (mặc định 8787) và `ADMIN_PASSWORD` (không bắt buộc).
- Có thể đưa riêng `dist/` lên hosting tĩnh, không chạy máy chủ. Khi đó game tự bốc quà theo `public/config.json` như trước, không có số giải, không có trang admin.

Tham số thử nghiệm, chỉ có tác dụng khi chạy `npm run dev` (bản build sẽ bỏ qua): `?turns=99` để đặt số lượt, `?reset` để xóa dữ liệu đã lưu.

### Sửa lời phù thủy

Lời đọc lá bài nằm trong `src/data/tarot.ts` (trường `message`), các câu thoại nằm trong `src/data/lines.ts`. Sau khi sửa, chạy:

```bash
npm run voice      # chỉ thu lại những câu mới hoặc đã đổi chữ (cần GOOGLE_API_KEY và ffmpeg)
python scripts/voice_check.py --all   # cho Whisper nghe lại để soát lời đọc
```

Câu nào đã đổi chữ mà chưa thu lại thì game vẫn hiện chữ, miệng vẫn mấp máy, nhưng không phát giọng cũ (sai lời). Đổi giọng: `TTS_VOICE=Aoede python scripts/voice_gen.py --force --best 3` (thu lại tất cả, mỗi câu giữ bản Whisper nghe rõ nhất).

## Quà, số giải và tỉ lệ trúng: trang admin

Mở `/admin.html`.
- **Mật khẩu:** lần chạy đầu tiên, máy chủ tự tạo mật khẩu, in ra console và lưu ở `server/data/admin-password.txt`. Đổi được trong tab *Cài đặt*. Nếu đặt biến `ADMIN_PASSWORD` thì dùng mật khẩu đó.
- **Dữ liệu:** nằm trong `server/data/tarot.db` (SQLite, không đưa vào git); trên Railway nằm trong volume `/data`. Lần đầu chạy, máy chủ chép quà và cài đặt từ `public/config.json`; từ đó sửa quà trên trang admin.
- **Bộ quà theo kế hoạch (`prizePlan`):** khi `public/config.json` có giá trị `prizePlan` mới (khác lần trước), máy chủ thay toàn bộ danh sách quà bằng danh sách trong file và áp dụng `pityEvery` của file, đúng một lần lúc khởi động. Số đã trúng được giữ theo mã món. Đây là cách đưa một bảng phân bổ quà mới lên mọi máy chủ khi deploy. Sau đó, chỉnh sửa trên trang admin được giữ cho đến khi đổi `prizePlan` lần nữa.
- **Đổi tên game theo kế hoạch (`brandPlan`):** tương tự, một giá trị `brandPlan` mới sẽ áp dụng `gameTitle`, `shopName`, `subtitle` của file đúng một lần. Hiện tại là "Tarot Ánh Trăng", tên quán "Thịnh Thế Vinh Hoa". Muốn đổi tiếp thì sửa trong admin, mục **Cài đặt**.

Trang admin có thanh menu bên trái, thanh tìm nhanh mã quà ở trên, chế độ sáng/tối, và dùng được trên điện thoại.

| Trang | Làm được gì |
|---|---|
| Tổng quan | Số lượt bốc hôm nay (so với cùng giờ hôm qua), mã quà phát ra, tỉ lệ đổi quà, số người chơi. Biểu đồ lượt bốc 14 ngày (xem được dạng bảng), quà đã trúng theo món, kho quà còn lại kèm cảnh báo *Sắp hết* và *Hết quà*, mã quà mới nhất. Tự làm mới mỗi 30 giây. |
| Quà & tỉ lệ | Bảng quà với tỉ lệ trúng, số còn lại, số hôm nay, công tắc bật/tắt. Bấm sửa hoặc *Thêm món quà* để mở khung bên phải: tên, mô tả, biểu tượng, độ hiếm, **tỉ lệ trúng (%)**, **tổng số giải**, **tối đa mỗi ngày**, cộng thêm lượt, phát mã, quà dự phòng. Có nút đặt lại "Đã trúng" khi bắt đầu đợt khuyến mại mới. |
| Mã quà | Lọc *Tất cả / Chưa đổi / Đã đổi / Hết hạn*, tìm theo mã, phân trang. Bấm *Xác nhận đổi* khi giao quà; mã đã đổi hoặc hết hạn sẽ bị từ chối. |
| Cài đặt | Tên cửa hàng, tên game, lượt bốc mỗi ngày, bảo đảm quà Hiếm sau N lượt, hạn dùng mã, tiền tố mã, lời dặn; đổi mật khẩu. |

**Cách máy chủ bốc quà:**
- Mỗi lượt, mỗi món có đúng xác suất bằng tỉ lệ đặt cho nó. Tổng tỉ lệ các món đang phát không được vượt 100%.
- Phần còn lại (nếu tổng chưa đủ 100%) thuộc về **quà dự phòng**. Quà dự phòng là đúng một món, luôn bật và không giới hạn số lượng, ví dụ *Lời chúc may mắn*.
- Món đã hết số giải, đã đủ số trong ngày hoặc đang tạm ngừng sẽ nhường phần tỉ lệ của nó cho quà dự phòng, nên tỉ lệ của các món khác không bị đội lên.
- Khách trúng quà *Thường* liên tiếp đủ số lần trong Cài đặt thì lượt sau chỉ bốc trong các món Hiếm trở lên còn quà, theo tỉ lệ tương đối giữa chúng. Máy chủ đếm chuỗi này theo mã người chơi.
- Mã quà do máy chủ phát, không trùng, có hạn dùng, và được lưu lại để nhân viên kiểm tra.

> **Lưu ý:**
> - Số lượt mỗi ngày vẫn được đếm trên máy người chơi (`localStorage`), nên người rành kỹ thuật có thể xóa dữ liệu để có lượt mới.
> - Máy chủ chặn bốc quá nhanh từ một địa chỉ IP (tối đa 300 lượt mỗi 10 phút), và quà không bao giờ phát vượt số giải.
> - Muốn giới hạn lượt chắc chắn theo từng khách thì cần đăng nhập, ví dụ bằng số điện thoại Zalo, như trong sơ đồ quy trình.

### Bộ quà hiện tại: `phan-bo-qua-2m-v2`

Theo bảng *Draft phân bổ quà tặng*, tính cho 2.000.000 lượt bốc. Tỉ lệ trúng của mỗi món bằng đúng số giải ÷ 2.000.000. Bảng gốc làm tròn tới 2 chữ số, nên tổng các số đã làm tròn là 100,03%.

| Món quà | Số giải | Tỉ lệ trúng | Độ hiếm |
|---|---:|---:|---|
| Bình Nước Gấu Trượt Tuyết | 100 | 0,005% | Huyền Thoại |
| Túi nhựa đan nhiều màu | 500 | 0,025% | Huyền Thoại |
| Gấu bông 12 chòm sao/Túi Gấm | 750 | 0,0375% | Sử Thi |
| Sổ tay nhật ký Manifest | 1.500 | 0,075% | Sử Thi |
| Móc khoá baby three CHĐ | 2.500 | 0,125% | Sử Thi |
| Vòng tay | 5.000 | 0,25% | Hiếm |
| Free Topping dưới 10k | 7.500 | 0,375% | Hiếm |
| Free Upsize | 10.000 | 0,5% | Hiếm |
| Giảm 20% tối đa 50.000đ | 5.000 | 0,25% | Hiếm |
| Mua 2 tặng 1 | 5.000 | 0,25% | Hiếm |
| BOGO: Mua 1 bill 49k tặng 1 ly M | 5.000 | 0,25% | Hiếm |
| Thẻ câu chúc (quà dự phòng, không phát mã) | 1.957.150 | 97,8575% | Thường |

- 11 món đầu phát mã quà để đổi tại quầy. Mỗi lượt có 2,1425% cơ hội trúng một trong các món này.
- Bảo đảm quà Hiếm đã tắt (`pityEvery: 0`). Nếu bật, khách sẽ trúng quà Hiếm trở lên khoảng 1 trong 6 lượt, quà hết nhanh hơn nhiều so với kế hoạch.
- Thẻ câu chúc là quà dự phòng nên không giới hạn số lượng. Số 1.957.150 trong bảng chỉ là phần còn lại của 2.000.000 lượt.

### Các trường của `public/config.json`

Các trường cài đặt giống tab *Cài đặt*. Mỗi món trong `prizes[]` có:
- `rate`: tỉ lệ trúng (%), dùng tối đa 4 chữ số thập phân.
- `quantity`: tổng số giải; bỏ trống nghĩa là không giới hạn.
- `fallback: true`: đánh dấu quà dự phòng.
- `weight`: tỉ lệ tương đối, chỉ dùng khi chạy bản tĩnh không có máy chủ. Khi đó không có số giải.
- `rarity`: `common` (Thường) · `rare` (Hiếm) · `epic` (Sử Thi) · `legendary` (Huyền Thoại). Độ hiếm quyết định màu phong ấn khi mở bài và độ hoành tráng của hiệu ứng.
- `icon`: `star`, `hourglass`, `ticket`, `giftbox`, `tea`, `envelope`, `crown`, `cake`, `crystal`.
- `voucher: true` sẽ sinh mã quà và lưu vào **Túi quà**. Đặt `extraTurns: 1` để món quà cộng thêm lượt bốc.

## Đã làm

- Cảnh mở đầu: cánh cửa khắc rune có đuốc hai bên, bấm "Bước vào phòng" thì cửa mở và camera lướt vào phòng.
  - Cánh cửa dựng 2.5D: hai cánh gỗ có độ dày thật (thấy mép khi cửa mở).
  - Hoa văn vàng nổi khối, bắt ánh hai ngọn đuốc chập chờn; phần vàng bóng hơn phần gỗ.
  - Rune tím phát sáng nhấp nháy, khe giữa hai cánh hắt ra vệt sáng ấm.
  - Các bản đồ nổi khối dựng lại bằng `python scripts/door_maps.py`.
- Căn phòng 3D: tranh nền (cửa sổ trăng tròn), bàn khăn nhung, nến lập lòe có ánh sáng, quả cầu pha lê, bụi ma thuật, bloom.
  - Khăn trải bàn buông tới sàn, có nếp gấp và sẫm dần về phía mép.
  - Dưới bàn có sàn gỗ và bóng đổ. Sàn vẽ trong tranh nền được làm tối để hai lớp sàn nối nhau trong bóng tối.
  - Sương mờ trôi sát mặt sàn che chỗ khăn chạm sàn, nên lúc đi qua cửa bàn không còn trông như khối trụ lơ lửng.
  - Camera trôi nhẹ và lệch theo con trỏ, nên thấy được chiều sâu của phòng và phù thủy.
- Phù thủy: một ảnh vẽ được dựng như con rối 2.5D (`src/scene/witch.ts`).
  - **Khối:** bản đồ chiều sâu `src/assets/img/witch_depth.png` (dựng bằng `python scripts/witch_depth.py`) đẩy mặt, hai bàn tay và phần giữa thân về phía người xem.
  - **Ánh sáng:** ánh nến ấm đổ theo hướng bề mặt (chập chờn theo ngọn nến), mép dáng người có viền ánh trăng, và có bóng mờ phía sau tách cô ấy khỏi tranh nền.
  - **Đầu:** quay và gật thật quanh cổ, nên mũi dịch nhiều hơn mũ trùm.
  - **Chuyển động:** đầu nghiêng, gật, quay, kèm thở, đung đưa và tóc lay theo. Hai tay nâng lên, xòe ra, ngón tay múa khi làm phép, run khi hồi hộp.
  - **Khuôn mặt:** chớp mắt (đôi khi chớp hai lần), nháy mắt, mắt liếc, nhướn hoặc nhíu mày, cười, buồn, há miệng ngạc nhiên. Miệng mở theo giọng nói (xem phần Giọng phù thủy bên dưới).
  - **Theo diễn biến game:**
    - cúi chào khi khách bước vào;
    - nhắm mắt tập trung khi xáo bài;
    - mắt dõi theo lá bài đang được rê chuột tới hoặc đang bay;
    - nghiêng người theo dõi khi phá phong ấn, giật mình ở mỗi tầng vỡ, há miệng khi màu được nâng cấp;
    - khi lật bài: gật đầu với quà thường, ngỡ ngàng rồi bật cười với quà hiếm hoặc huyền thoại, xòe tay đón món quà;
    - buồn và lắc đầu khi hết lượt.
  - **Lúc chờ:** tự liếc bộ bài hoặc quả cầu, nghiêng đầu, mỉm cười, thở dài, thỉnh thoảng nháy mắt.
  - **Chạm vào phù thủy:** cô ấy khúc khích, nháy mắt và trêu khách.
  - Khi làm phép, mắt và tay phát sáng. Bong bóng thoại tiếng Việt thay đổi theo từng tình huống.
- Giọng phù thủy (lồng tiếng sẵn bằng Gemini TTS, giọng **Erinome**: cô gái trẻ giọng Bắc, trong, bí ẩn, nói nhanh):
  - 22 lời đọc lá bài, mỗi lá khoảng 60–70 chữ đọc trong 17–22 giây (khoảng 3,5 chữ/giây), và 27 câu thoại theo tình huống: chào khách, chờ, chọn bài, phá phong ấn, nâng cấp, lật bài, xáo bài, hết lượt, bị chọc.
  - Miệng mở theo âm lượng thật của câu đang đọc. Khi đọc dài, cô ấy thỉnh thoảng gật, nghiêng đầu, rướn người.
  - Nhạc nền nhỏ lại khi cô ấy nói. Chữ trong bong bóng thoại chạy cùng giọng.
  - Trên bảng kết quả, lời đọc nằm trong khung 4 dòng (3 dòng trên điện thoại) tự cuộn theo giọng như phụ đề, nên món quà và mã quà luôn hiện. Bấm "Bốc tiếp" là dừng đọc.
  - File giọng tải khi cần: các câu ngắn tải lúc cửa mở, lời đọc lá bài tải ngay khi biết lá bốc được.
  - Chọn giọng: thử 8 giọng nữ trẻ trên hai model, rồi 5 giọng tốt nhất với ba câu khác nhau, cho Whisper nghe lại để chấm độ rõ tiếng Việt và đo cao độ, tốc độ. Erinome có giọng cao nhất (trẻ nhất), nói nhanh nhất và đọc lời dài rõ nhất (99–100%). Các bản thử nằm trong `asset_src/voice/` (`aud2_*`, `aud4_*`).
  - Mỗi câu được thu tối đa 3 bản, giữ bản Whisper nghe đúng nhất.
- Quạt 11 lá bài bay lơ lửng: nâng lên khi rê chuột (trên điện thoại chạm lần 1 để nâng, lần 2 để chọn). Hoạt ảnh xáo và chia bài từ tay phù thủy.
- Chuỗi mở bài hồi hộp:
  1. Lá bài bay tới trước mặt người chơi, vòng tròn ma thuật hiện ra, nhịp tim dồn dập.
  2. **3 tầng phong ấn** phải chạm để phá. Mỗi tầng vỡ lộ dần màu độ hiếm và có thể "nâng cấp" (Xanh → Tím → Hồng → Vàng), tầng cuối có màu chập chờn trước khi chốt.
  3. Lá bài rung mạnh, rồi lật kèm chớp sáng, tia sáng và pháo hạt.
  4. Món quà trồi lên từ sau lá bài.
- Bảng kết quả: độ hiếm, tên lá bài (Việt/Anh), từ khóa, lời đọc của phù thủy (chữ chạy theo giọng), món quà, mã voucher (chạm để sao chép), hạn dùng.
- Vòng lặp giữ chân người chơi: lượt theo ngày với đồng hồ đếm ngược, quà "+1 lượt", thanh *Năng lượng vũ trụ* (bảo đảm quà Hiếm), *Bộ sưu tập* 22 lá (ưu tiên ra lá chưa có), *Túi quà*.
- Âm thanh tự tổng hợp bằng WebAudio: nhạc nền huyền bí (Rê thứ, harp/pad/celesta), tiếng vỡ phong ấn, nhịp tim, riser, lật bài, quà. Có nút tắt tiếng.
- Bố cục dọc cho điện thoại (bảng kết quả dạng sheet dưới, nút "Bốc tiếp" luôn hiện) và bố cục ngang cho máy tính.
- Máy chủ quà (`server/`, Node + SQLite) và trang admin (`admin.html`):
  - quà có tỉ lệ trúng, tổng số giải và giới hạn mỗi ngày;
  - quà dự phòng khi hết quà;
  - bốc quà và phát mã ngay trên máy chủ;
  - nhân viên tra và xác nhận đổi mã;
  - thống kê lượt bốc.

## Còn lại / gợi ý

- Nhạc nền và hiệu ứng vẫn tổng hợp bằng code. Khóa `GOOGLE_API_KEY` nay có liệt kê model nhạc Lyria nhưng chưa thử.
- Phù thủy 3D thật: ảnh tham chiếu và prompt đã có, đang chờ mô hình GLB tạo trên web Tripo. Bản 2.5D hiện tại sẽ là phương án dự phòng.
- Đếm lượt chơi trên máy chủ theo từng khách. Cần khách đăng nhập (số điện thoại Zalo) mới chống được việc xóa dữ liệu để có lượt mới.
- Có thể thêm: chia sẻ lá bài lên mạng xã hội để nhận thêm lượt, phần thưởng khi hoàn thành bộ 22 lá.
- **Tạm hoãn, chờ lệnh (13/11/2026): sửa theo [chính sách kiểm duyệt Zalo Mini App](https://miniapp.zaloplatforms.com/documents/zalo-mini-app-censorship-policy/?lang=vi).** Zalo không cho mở web bên ngoài qua webview, nên game phải được đóng vào chính gói Mini App (giới hạn 10 MB mỗi gói, 3 MB mỗi file; bản build hiện tại khoảng 7 MB). Việc cần làm khi bắt đầu:
  - Sơ đồ swimlane (`.archify/workflow-tich-luot-choi-20261112-110518/`): ở Bước 1, chỉ xin số điện thoại khi khách bấm chơi hoặc xem lượt, không xin ngay lúc mở; khách từ chối vẫn xem được thể lệ và danh sách quà.
  - Bộ slide quy trình mới: thêm slide "Đưa game vào Mini App", sửa Bước 1, thêm các lưu ý về chữ "trả thưởng" (chỉ dùng quà voucher), Checkout SDK nếu màn hết lượt hiện giá, và ghi ngày bắt đầu, kết thúc chương trình.
  - Bộ slide cũ: bỏ phương án dự phòng "Web riêng (openWebview)".
  - Game: bỏ bộ font `.woff` trùng (0,49 MB), tải ảnh mặt bài sau khi căn phòng đã hiện (Zalo coi tải quá 10 giây là vi phạm), chạy thử trên điện thoại thật trong Zalo.
  - Giọng đọc (`public/voice`, 3,1 MB) làm gói vượt 10 MB: tải file giọng từ máy chủ game thay vì đóng vào gói, hoặc giảm bitrate.

## Quay video kiểm tra

Khi `npm run dev` đang chạy:

```bash
node scripts/capture.mjs shots              # ảnh các khoảnh khắc chính → screenshots/shots
node scripts/capture.mjs video --rarity legendary   # video ~19 s → screenshots/proof.mp4
node scripts/capture.mjs witch --w 1600 --h 900     # video phù thủy diễn, có khung phóng to mặt → screenshots/witch.mp4
node scripts/capture.mjs voice --card 19            # video có tiếng: lời chào, chọc, phong ấn, đọc lá → screenshots/voice.mp4
node scripts/witchlab.mjs face                      # chụp từng biểu cảm (face|body) → screenshots/witchlab
```

Trang `witchlab.html` (chỉ dùng khi phát triển) hiện riêng phù thủy ở cự ly gần để chỉnh khung rối. Thêm `&orbit=30` để nhìn lệch góc kiểm tra chiều sâu (với script: `ORBIT=30 node scripts/witchlab.mjs body`). Trong console, `window.__ov = { uLid: [1, 1, 0, 0] }` ép một biểu cảm cụ thể.

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
| Nổi khối cánh cửa | Normal map (hoa văn vàng nổi, rune chìm), bản đồ vật liệu (vàng bóng, gỗ nhám), mặt nạ rune phát sáng | như cánh cửa | `src/assets/img/door_normal.webp`, `door_orm.webp`, `door_runes.webp` (từ `scripts/door_maps.py`) | 0 |
| Icon quà (9) | star, hourglass, ticket, giftbox, tea, envelope, crown, cake, crystal (đã tách nền) | 72 px trong bảng; ~0,14 m trong cảnh | `src/assets/icons/*.webp` (384×384) | 10¢ |
| Ảnh quà theo bộ phân bổ (12) | bottle, woven-bag, teddy, notebook, keychain, bracelet, topping, upsize, discount, buy2get1, bogo, wishcard (đã tách nền, cùng phong cách bộ icon cũ) | 72 px trong bảng; ~0,14 m trong cảnh | `src/assets/icons/*.webp` (384×384); bảng gốc `asset_src/misc/gifts_kit_a.png`, `gifts_kit_b.png` | 2 × 10¢ |
| Chiều sâu phù thủy | Bản đồ độ sâu (trắng = gần): phồng theo dáng người, mặt hình bầu dục, hai bàn tay nhô ra | 510×650, đọc trong shader | `src/assets/img/witch_depth.png` (từ `scripts/witch_depth.py`) | 0 |
| Phù thủy tư thế chữ T | Ảnh tham chiếu toàn thân để tạo mô hình 3D trên Tripo | — (chưa dùng trong game) | `asset_src/witch3d/witch_tpose_clean.png` | 10¢ |
| Âm thanh | Nhạc nền và hiệu ứng tổng hợp bằng WebAudio | vòng lặp 8 ô nhịp, 72 BPM | `src/audio/audio.ts` | 0 |
| Giọng phù thủy (49 câu) | Gemini TTS `gemini-2.5-flash-preview-tts`, giọng Erinome (cô gái trẻ giọng Bắc, nói nhanh): 22 lời đọc lá bài và 27 câu thoại. Lời lấy từ `src/data/tarot.ts` và `src/data/lines.ts` | MP3 mono 24 kHz, 48 kbps, tổng 8,4 phút, 3,1 MB; tải khi cần | `public/voice/*.mp3` và `manifest.json` (từ `npm run voice`); các bản thử giọng trong `asset_src/voice/` | ≈ 0,35 $ (ước tính), cộng ≈ 0,46 $ cho bản giọng Vindemiatrix thu trước đó |
| Texture thủ tục | Phong ấn, vòng ma thuật, tia sáng, khăn nhung, tường đá | — | `src/scene/textures.ts` | 0 |

**Tổng chi phí tạo tài nguyên: ≈ 3,09 $.**
