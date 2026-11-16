// Everything the witch says out loud, grouped by moment. Each line has a recorded voice
// (public/voice, made by `npm run voice`): after editing a line, run it again to re-record.

export const LINES = {
  welcome: ['Chào mừng lữ khách đến với căn phòng của ta... Hãy chọn một lá bài, định mệnh sẽ lên tiếng.'],
  idle: ['Lá bài nào đang gọi tên bạn?', 'Đừng ngần ngại... hãy nghe theo trực giác.', 'Ta cảm nhận được điều đặc biệt hôm nay...', 'Các vì sao đang chờ bạn lựa chọn.'],
  pick: ['Lá bài này đã chọn bạn...', 'Một lựa chọn thú vị...', 'Ồ... trực giác của bạn thật nhạy bén.'],
  seals: ['Hãy phá bỏ ba tầng phong ấn!'],
  upgrade: ['', 'Ồ...? Năng lượng đang thay đổi!', 'Không thể nào... ánh sáng này!', 'CÁC VÌ SAO ĐANG RUNG CHUYỂN!'],
  reveal: [
    ['Vũ trụ gửi lời nhắn đến bạn.', 'Hãy lắng nghe thông điệp này.'],
    ['Một điềm lành hiếm có!', 'Định mệnh đang mỉm cười với bạn.'],
    ['Thật phi thường! Định mệnh ưu ái bạn!'],
    ['Huyền thoại! Ta chưa từng thấy lá bài nào sáng đến thế!'],
  ],
  shuffle: ['Để ta xáo lại các vì sao...', 'Bộ bài đang thì thầm...'],
  noTurns: ['Năng lượng của bạn đã cạn... hãy quay lại khi trăng lên nhé.'],
  pity: ['Năng lượng vũ trụ đã đầy... lá này chắc chắn không tầm thường!'],
  offline: ['Các vì sao đang bị mây che... bạn thử lại sau giây lát nhé.'],
  poke: ['Hihi... chọc ta làm gì, hãy chọn một lá bài đi!', 'Ta không phải lá bài đâu nhé~', 'Đôi mắt ta thấy cả định mệnh của bạn đấy...', 'Suỵt... các vì sao đang nghe lén đấy.'],
};
