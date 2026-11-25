export function formatInt(n) {
  return Number(n).toLocaleString('vi-VN');
}

export function postPreview(message, max = 80) {
  const text = message || '(Bài viết không có nội dung chữ)';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function formatMilestoneList(milestones) {
  return milestones.map((m) => formatInt(m)).join(', ');
}