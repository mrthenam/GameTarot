// The 22 Major Arcana: Vietnamese names, keywords and the witch's reading of each.
// The witch reads `message` aloud: after editing one, run `npm run voice` to re-record it.

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
    message: 'Chàng Khờ mỉm cười với bạn từ mép vực của một hành trình mới. Đừng đợi mọi thứ hoàn hảo rồi mới bước đi; sự hồn nhiên và lòng tò mò chính là đôi cánh của bạn lúc này. Hãy thử một điều chưa từng làm, nói lời chào với một cơ hội lạ. Vũ trụ luôn che chở cho những trái tim dám bắt đầu.' },
  { id: 1, numeral: 'I', nameVi: 'Nhà Ảo Thuật', nameEn: 'The Magician', keywords: ['Ý chí', 'Sáng tạo', 'Hành động'],
    message: 'Nhà Ảo Thuật đặt trước mặt bạn đủ cả bốn nguyên tố: lửa của đam mê, nước của cảm xúc, khí của trí tuệ và đất của sự bền bỉ. Mọi công cụ bạn cần đã nằm sẵn trong tay, điều còn thiếu chỉ là một hành động đầu tiên. Hãy nói ra mong muốn của mình thật rõ ràng, rồi bắt tay vào làm. Phép màu sẽ thành hình.' },
  { id: 2, numeral: 'II', nameVi: 'Nữ Tư Tế', nameEn: 'The High Priestess', keywords: ['Trực giác', 'Bí ẩn', 'Tĩnh lặng'],
    message: 'Nữ Tư Tế ngồi lặng giữa hai cột trụ sáng và tối, giữ cuộn sách của những điều chưa nói. Câu trả lời bạn đang tìm không ở đâu xa, nó nằm ngay trong tiếng thì thầm nhỏ bé của lòng bạn. Hôm nay, hãy dành cho mình một khoảng lặng, ghi lại những giấc mơ và linh cảm. Trực giác của bạn đang sáng như trăng rằm.' },
  { id: 3, numeral: 'III', nameVi: 'Nữ Hoàng', nameEn: 'The Empress', keywords: ['Sung túc', 'Yêu thương', 'Nảy nở'],
    message: 'Nữ Hoàng mang đến một mùa sung túc và vòng tay yêu thương. Những hạt giống bạn kiên nhẫn gieo trồng bấy lâu đang bắt đầu đơm hoa. Hãy đối xử với bản thân thật dịu dàng: ăn một bữa ngon, khoác lên bộ đồ đẹp, dành thời gian cho người thương. Khi bạn biết nâng niu chính mình, sự dồi dào sẽ tự tìm đến.' },
  { id: 4, numeral: 'IV', nameVi: 'Hoàng Đế', nameEn: 'The Emperor', keywords: ['Vững vàng', 'Kỷ luật', 'Che chở'],
    message: 'Hoàng Đế ngồi vững trên ngai đá, nhắc bạn rằng mình có đủ sức mạnh để làm chủ hoàn cảnh. Đây là lúc biến ước muốn thành một kế hoạch rõ ràng: đặt mục tiêu, chia từng bước, và giữ kỷ luật với chính mình. Đừng ngại đứng ra dẫn dắt. Sự vững vàng của bạn sẽ là chỗ dựa cho cả những người xung quanh.' },
  { id: 5, numeral: 'V', nameVi: 'Giáo Hoàng', nameEn: 'The Hierophant', keywords: ['Niềm tin', 'Học hỏi', 'Truyền thống'],
    message: 'Giáo Hoàng mở ra cánh cửa của tri thức và những giá trị bền lâu. Một lời khuyên quý giá đang chờ bạn từ người đi trước, có thể là thầy cô, cha mẹ, hay một người bạn từng trải. Hãy mở lòng lắng nghe và học hỏi. Những điều tốt đẹp bạn gìn giữ bấy lâu sẽ trở thành ngọn đèn soi đường cho bạn.' },
  { id: 6, numeral: 'VI', nameVi: 'Tình Nhân', nameEn: 'The Lovers', keywords: ['Tình yêu', 'Hòa hợp', 'Lựa chọn'],
    message: 'Tình Nhân xuất hiện khi trái tim bạn đang được vũ trụ chở che. Một kết nối đẹp đẽ đang đến gần, hoặc một mối quan hệ thân quen sẽ trở nên gắn bó hơn. Lá bài này cũng nói về lựa chọn: khi đứng trước ngã rẽ, hãy chọn điều cho phép bạn được là chính mình. Yêu thương chân thành luôn mang lại hạnh phúc.' },
  { id: 7, numeral: 'VII', nameVi: 'Cỗ Xe', nameEn: 'The Chariot', keywords: ['Chiến thắng', 'Quyết tâm', 'Tiến lên'],
    message: 'Cỗ Xe đang lao về phía trước, và người cầm cương chính là bạn. Hai con ngựa sáng và tối có thể kéo về hai hướng, nhưng ý chí của bạn đủ mạnh để giữ chúng trên cùng một đường. Hãy tập trung vào đích đến, đừng để những lời bàn tán làm chậm bước. Chiến thắng đang chờ ở cuối con đường, chỉ cần bạn đừng buông dây cương.' },
  { id: 8, numeral: 'VIII', nameVi: 'Sức Mạnh', nameEn: 'Strength', keywords: ['Can đảm', 'Kiên nhẫn', 'Dịu dàng'],
    message: 'Lá Sức Mạnh vẽ một người con gái dịu dàng vuốt ve chú sư tử. Sức mạnh thật sự không nằm ở cơ bắp, mà ở một trái tim bình tĩnh và lòng kiên nhẫn. Nếu gặp chuyện khó, hãy hít thở thật sâu, mỉm cười và đối diện nó bằng sự mềm mỏng. Bạn bản lĩnh hơn mình vẫn nghĩ, và không khó khăn nào là không thể thuần phục.' },
  { id: 9, numeral: 'IX', nameVi: 'Ẩn Sĩ', nameEn: 'The Hermit', keywords: ['Suy ngẫm', 'Thông thái', 'Nội tâm'],
    message: 'Ẩn Sĩ đứng một mình trên đỉnh núi tuyết, tay nâng ngọn đèn nhỏ. Lá bài này nhắc bạn rằng đôi khi phải chậm lại mới nhìn rõ con đường. Hãy dành cho mình một buổi tối yên tĩnh, tắt bớt tiếng ồn bên ngoài, và tự hỏi điều gì thật sự quan trọng với bạn. Ngọn đèn trong tim bạn sẽ dẫn lối qua mọi đêm tối.' },
  { id: 10, numeral: 'X', nameVi: 'Vòng Quay Định Mệnh', nameEn: 'Wheel of Fortune', keywords: ['May mắn', 'Bước ngoặt', 'Vận mệnh'],
    message: 'Bánh xe định mệnh đang xoay, và lần này nó quay về phía bạn! Một bước ngoặt may mắn sắp xuất hiện, có thể là một cuộc gặp tình cờ, hay một cơ hội không ai ngờ tới. Hãy để ý những dấu hiệu nhỏ quanh mình, và sẵn sàng nắm lấy khi thời cơ đến. Vận may luôn mỉm cười với những người đã chuẩn bị sẵn sàng.' },
  { id: 11, numeral: 'XI', nameVi: 'Công Lý', nameEn: 'Justice', keywords: ['Công bằng', 'Sự thật', 'Cân bằng'],
    message: 'Công Lý giơ cao thanh gươm và chiếc cân vàng. Những nỗ lực chân thành của bạn đã được ghi nhận, và sự đền đáp xứng đáng đang trên đường đến. Nếu bạn còn phân vân trước một quyết định, hãy cân nhắc bằng cả lý trí lẫn lương tâm. Cứ giữ sự ngay thẳng, vì vũ trụ luôn tìm cách cân bằng mọi điều.' },
  { id: 12, numeral: 'XII', nameVi: 'Người Treo Ngược', nameEn: 'The Hanged Man', keywords: ['Buông bỏ', 'Góc nhìn mới', 'Chờ đợi'],
    message: 'Người Treo Ngược bình thản giữa không trung, mái đầu tỏa sáng. Lá bài này mời bạn nhìn mọi việc từ một góc hoàn toàn khác. Điều tưởng là bế tắc, có khi chỉ là lúc cần dừng lại và buông bớt. Đừng vội ép mọi thứ theo ý mình. Khoảng lặng hôm nay đang chuẩn bị cho sự bừng sáng ngày mai.' },
  { id: 13, numeral: 'XIII', nameVi: 'Sự Chuyển Hóa', nameEn: 'Death', keywords: ['Khép lại', 'Tái sinh', 'Đổi mới'],
    message: 'Sự Chuyển Hóa không phải là kết thúc, mà là một cánh cửa. Một chương cũ đang khép lại để chương mới rực rỡ hơn được mở ra. Hãy nhẹ nhàng buông những thói quen và nỗi lo không còn giúp ích cho bạn. Như cánh bướm rời khỏi chiếc kén, bạn đang tái sinh. Đừng sợ thay đổi, vì bình minh luôn đến sau đêm dài.' },
  { id: 14, numeral: 'XIV', nameVi: 'Tiết Độ', nameEn: 'Temperance', keywords: ['Hài hòa', 'Chữa lành', 'Kiên nhẫn'],
    message: 'Thiên thần Tiết Độ kiên nhẫn rót nước qua lại giữa hai chiếc cốc, không vội vàng, cũng không để rơi một giọt. Sự cân bằng chính là phép màu của bạn lúc này. Hãy dung hòa giữa làm việc và nghỉ ngơi, giữa cho đi và nhận về. Từng chút một, mọi thứ đang hòa quyện, chữa lành, và trở nên tốt đẹp hơn.' },
  { id: 15, numeral: 'XV', nameVi: 'Ác Quỷ', nameEn: 'The Devil', keywords: ['Cám dỗ', 'Giải phóng', 'Đam mê'],
    message: 'Đừng sợ lá Ác Quỷ. Hãy nhìn kỹ mà xem: sợi xích quanh cổ hai người kia rất lỏng, họ có thể tự tháo ra bất cứ lúc nào. Lá bài nhắc bạn rằng chìa khóa vẫn luôn nằm trong tay bạn. Hãy gọi tên điều đang trói buộc mình, một thói quen, một nỗi sợ hay một mối bận tâm, rồi mạnh dạn buông nó. Tự do chỉ cách bạn một bước chân.' },
  { id: 16, numeral: 'XVI', nameVi: 'Tòa Tháp', nameEn: 'The Tower', keywords: ['Đột phá', 'Thức tỉnh', 'Làm mới'],
    message: 'Tòa Tháp rung chuyển dưới tia sét, và đó là một lời thức tỉnh. Một thay đổi bất ngờ có thể khiến bạn bối rối lúc đầu, nhưng nó chỉ phá đi những gì vốn đã không còn vững. Hãy giữ bình tĩnh, và nhìn vào khoảng trời mới vừa mở ra. Trên một nền móng chắc chắn hơn, bạn sẽ xây nên điều tuyệt vời hơn trước.' },
  { id: 17, numeral: 'XVII', nameVi: 'Ngôi Sao', nameEn: 'The Star', keywords: ['Hy vọng', 'Cảm hứng', 'Chữa lành'],
    message: 'Ngôi Sao lấp lánh sau cơn giông, mang theo hy vọng và sự chữa lành. Những vết thương cũ đang dần khép lại, và nguồn cảm hứng đang trở về với bạn. Tối nay, hãy ngước nhìn bầu trời và thì thầm điều ước của mình. Các vì sao đang lắng nghe, và điều bạn mong mỏi đang trên đường thành hiện thực.' },
  { id: 18, numeral: 'XVIII', nameVi: 'Mặt Trăng', nameEn: 'The Moon', keywords: ['Giấc mơ', 'Trực giác', 'Bí ẩn'],
    message: 'Mặt Trăng soi xuống một con đường phủ đầy sương. Không phải mọi thứ đều như vẻ bề ngoài, nên đừng vội tin vào những lời đồn hay nỗi lo trong đầu. Hãy để trực giác dẫn lối, và chú ý đến những giấc mơ gần đây, chúng đang muốn nói với bạn điều gì đó. Cứ bước chậm mà chắc, bình minh đang đến rất gần.' },
  { id: 19, numeral: 'XIX', nameVi: 'Mặt Trời', nameEn: 'The Sun', keywords: ['Niềm vui', 'Thành công', 'Rạng rỡ'],
    message: 'Mặt Trời rực rỡ đang chiếu thẳng vào bạn! Đây là một trong những lá bài tươi sáng nhất của cả bộ bài. Niềm vui, thành công và năng lượng tích cực sẽ ngập tràn những ngày tới. Hãy sống hồn nhiên như một đứa trẻ, chia sẻ tiếng cười với mọi người, và tự tin tỏa sáng. Bạn xứng đáng với tất cả những điều tốt đẹp ấy.' },
  { id: 20, numeral: 'XX', nameVi: 'Phán Xét', nameEn: 'Judgement', keywords: ['Thức tỉnh', 'Vươn mình', 'Tiếng gọi'],
    message: 'Tiếng kèn của lá Phán Xét vang lên, đánh thức một phần trong bạn đã ngủ quên bấy lâu. Có thể đó là một ước mơ cũ, một tài năng chưa dùng đến, hay một lời hứa với chính mình. Hãy tha thứ cho quá khứ và đáp lại tiếng gọi ấy. Đây là thời điểm hoàn hảo để bạn vươn mình, trở thành phiên bản tốt nhất của chính mình.' },
  { id: 21, numeral: 'XXI', nameVi: 'Thế Giới', nameEn: 'The World', keywords: ['Hoàn thành', 'Viên mãn', 'Thành tựu'],
    message: 'Thế Giới là lá bài cuối cùng của bộ Ẩn Chính, biểu tượng của sự viên mãn. Một vòng tròn đã khép lại trọn vẹn, và bạn đã đi một chặng đường dài để đến được đây. Hãy dành thời gian ăn mừng thành quả, và cảm ơn những người đã đồng hành cùng bạn. Khi một hành trình hoàn tất, một chân trời mới lại mở ra.' },
];

/** Cards that feel "lucky": preferred when a high-rarity gift is drawn. */
export const LUCKY_CARDS = [10, 17, 19, 21, 3, 7];
