// The 22 Major Arcana: Vietnamese names, keywords and the deck's message for each.

export interface TarotCard {
  id: number;
  numeral: string;
  nameVi: string;
  nameEn: string;
  keywords: [string, string, string];
  message: string;
}

export const TAROT: TarotCard[] = [
  { id: 0, numeral: '0', nameVi: 'Chàng Khờ', nameEn: 'The Fool', keywords: ['Khởi đầu', 'Tự do', 'Phiêu lưu'],
    message: 'Một hành trình mới đang mở ra trước mắt bạn. Hãy bước đi với trái tim nhẹ nhõm — đôi khi sự hồn nhiên chính là lòng dũng cảm lớn nhất.' },
  { id: 1, numeral: 'I', nameVi: 'Nhà Ảo Thuật', nameEn: 'The Magician', keywords: ['Ý chí', 'Sáng tạo', 'Hành động'],
    message: 'Mọi công cụ bạn cần đã nằm sẵn trong tay. Chỉ cần bạn tin và bắt đầu, phép màu sẽ thành hình.' },
  { id: 2, numeral: 'II', nameVi: 'Nữ Tư Tế', nameEn: 'The High Priestess', keywords: ['Trực giác', 'Bí ẩn', 'Tĩnh lặng'],
    message: 'Câu trả lời bạn tìm không ở đâu xa. Hãy lắng nghe tiếng nói nhỏ bé bên trong — trực giác của bạn hôm nay rất sáng suốt.' },
  { id: 3, numeral: 'III', nameVi: 'Nữ Hoàng', nameEn: 'The Empress', keywords: ['Sung túc', 'Yêu thương', 'Nảy nở'],
    message: 'Sự dồi dào đang tìm đến bạn. Hãy chăm sóc bản thân thật dịu dàng, vì những gì bạn gieo trồng đang bắt đầu đơm hoa.' },
  { id: 4, numeral: 'IV', nameVi: 'Hoàng Đế', nameEn: 'The Emperor', keywords: ['Vững vàng', 'Kỷ luật', 'Che chở'],
    message: 'Bạn có đủ sức mạnh để làm chủ hoàn cảnh. Một kế hoạch rõ ràng sẽ biến ước muốn thành hiện thực.' },
  { id: 5, numeral: 'V', nameVi: 'Giáo Hoàng', nameEn: 'The Hierophant', keywords: ['Niềm tin', 'Học hỏi', 'Truyền thống'],
    message: 'Một lời khuyên quý giá đang chờ bạn từ người đi trước. Hãy mở lòng học hỏi — tri thức sẽ soi đường.' },
  { id: 6, numeral: 'VI', nameVi: 'Tình Nhân', nameEn: 'The Lovers', keywords: ['Tình yêu', 'Hòa hợp', 'Lựa chọn'],
    message: 'Trái tim bạn đang được vũ trụ chở che. Một kết nối đẹp đẽ — hoặc một lựa chọn từ tâm — sẽ mang lại hạnh phúc.' },
  { id: 7, numeral: 'VII', nameVi: 'Cỗ Xe', nameEn: 'The Chariot', keywords: ['Chiến thắng', 'Quyết tâm', 'Tiến lên'],
    message: 'Hãy cầm chắc dây cương! Sự quyết tâm của bạn sẽ đưa bạn vượt qua mọi trở ngại để về đích.' },
  { id: 8, numeral: 'VIII', nameVi: 'Sức Mạnh', nameEn: 'Strength', keywords: ['Can đảm', 'Kiên nhẫn', 'Dịu dàng'],
    message: 'Sức mạnh thật sự nằm ở sự dịu dàng. Bạn đủ bản lĩnh để thuần phục mọi khó khăn bằng lòng kiên nhẫn.' },
  { id: 9, numeral: 'IX', nameVi: 'Ẩn Sĩ', nameEn: 'The Hermit', keywords: ['Suy ngẫm', 'Thông thái', 'Nội tâm'],
    message: 'Đôi khi cần chậm lại để nhìn rõ hơn. Ngọn đèn trong tim bạn sẽ dẫn lối qua mọi đêm tối.' },
  { id: 10, numeral: 'X', nameVi: 'Vòng Quay Định Mệnh', nameEn: 'Wheel of Fortune', keywords: ['May mắn', 'Bước ngoặt', 'Vận mệnh'],
    message: 'Bánh xe vận mệnh đang quay về phía bạn! Một bước ngoặt may mắn sắp xuất hiện — hãy sẵn sàng đón nhận.' },
  { id: 11, numeral: 'XI', nameVi: 'Công Lý', nameEn: 'Justice', keywords: ['Công bằng', 'Sự thật', 'Cân bằng'],
    message: 'Những nỗ lực chân thành của bạn sẽ được đền đáp xứng đáng. Hãy giữ sự ngay thẳng, vũ trụ luôn cân bằng.' },
  { id: 12, numeral: 'XII', nameVi: 'Người Treo Ngược', nameEn: 'The Hanged Man', keywords: ['Buông bỏ', 'Góc nhìn mới', 'Chờ đợi'],
    message: 'Hãy thử nhìn mọi việc từ một góc khác. Khoảng lặng hôm nay đang chuẩn bị cho sự bừng sáng ngày mai.' },
  { id: 13, numeral: 'XIII', nameVi: 'Sự Chuyển Hóa', nameEn: 'Death', keywords: ['Khép lại', 'Tái sinh', 'Đổi mới'],
    message: 'Một chương cũ khép lại để chương mới rực rỡ hơn mở ra. Đừng sợ thay đổi — đó là lúc bạn tái sinh.' },
  { id: 14, numeral: 'XIV', nameVi: 'Tiết Độ', nameEn: 'Temperance', keywords: ['Hài hòa', 'Chữa lành', 'Kiên nhẫn'],
    message: 'Sự cân bằng là phép màu của bạn lúc này. Từng chút một, mọi thứ đang hòa quyện và trở nên tốt đẹp.' },
  { id: 15, numeral: 'XV', nameVi: 'Ác Quỷ', nameEn: 'The Devil', keywords: ['Cám dỗ', 'Giải phóng', 'Đam mê'],
    message: 'Bạn nắm giữ chìa khóa của chính mình. Hãy buông điều đang trói buộc bạn — tự do chỉ cách một bước chân.' },
  { id: 16, numeral: 'XVI', nameVi: 'Tòa Tháp', nameEn: 'The Tower', keywords: ['Đột phá', 'Thức tỉnh', 'Làm mới'],
    message: 'Một thay đổi bất ngờ sẽ phá vỡ những gì không còn phù hợp, mở đường cho một nền móng vững chắc hơn.' },
  { id: 17, numeral: 'XVII', nameVi: 'Ngôi Sao', nameEn: 'The Star', keywords: ['Hy vọng', 'Cảm hứng', 'Chữa lành'],
    message: 'Hãy tiếp tục hy vọng, vì các vì sao đang lắng nghe. Điều ước của bạn đang trên đường thành hiện thực.' },
  { id: 18, numeral: 'XVIII', nameVi: 'Mặt Trăng', nameEn: 'The Moon', keywords: ['Giấc mơ', 'Trực giác', 'Bí ẩn'],
    message: 'Không phải mọi thứ đều như vẻ ngoài. Hãy để trực giác dẫn lối qua màn sương — bình minh đang đến gần.' },
  { id: 19, numeral: 'XIX', nameVi: 'Mặt Trời', nameEn: 'The Sun', keywords: ['Niềm vui', 'Thành công', 'Rạng rỡ'],
    message: 'Ánh mặt trời đang chiếu rọi bạn! Niềm vui, thành công và năng lượng tích cực sẽ ngập tràn những ngày tới.' },
  { id: 20, numeral: 'XX', nameVi: 'Phán Xét', nameEn: 'Judgement', keywords: ['Thức tỉnh', 'Vươn mình', 'Tiếng gọi'],
    message: 'Một tiếng gọi đang đánh thức bạn. Đây là thời điểm hoàn hảo để vươn mình và trở thành phiên bản tốt nhất.' },
  { id: 21, numeral: 'XXI', nameVi: 'Thế Giới', nameEn: 'The World', keywords: ['Hoàn thành', 'Viên mãn', 'Thành tựu'],
    message: 'Một vòng tròn đã khép lại trọn vẹn. Bạn đã đi một chặng đường dài — hãy ăn mừng thành quả của mình!' },
];

/** Cards that feel "lucky": preferred when a high-rarity gift is drawn. */
export const LUCKY_CARDS = [10, 17, 19, 21, 3, 7];
