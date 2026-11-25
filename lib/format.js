const NOTIFY_TZ = 'Asia/Ho_Chi_Minh';

export function formatInt(n) {
  return Number(n).toLocaleString('vi-VN');
}

/** Ngày giờ thông báo (giờ VN). */
export function formatNotifyDateTime(date = new Date()) {
  return date.toLocaleString('vi-VN', {
    timeZone: NOTIFY_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function postPreview(message, max = 80) {
  const text = message || '(Bài viết không có nội dung chữ)';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function formatMilestoneList(milestones) {
  return milestones.map((m) => formatInt(m)).join(', ');
}

function reelTitle(text) {
  const t = (text || '').trim();
  return t || '(Không có tiêu đề)';
}

/** Tin báo mốc view (HTML Telegram). */
export function formatMilestoneAlert({
  pageName,
  title,
  newHits,
  views,
  likes = 0,
  comments = 0,
  shares = 0,
  url,
}) {
  const when = formatNotifyDateTime();
  return (
    `🔥 Mốc mới: <b>${formatMilestoneList(newHits)}</b> view\n` +
    `🕐 ${when}\n` +
    `Kênh: <b>${pageName}</b>\n` +
    `reels: ${reelTitle(title)}\n` +
    `👍 ${formatInt(likes)}  💬 ${formatInt(comments)}  ↗️ ${formatInt(shares)}\n` +
    `👀 <b>${formatInt(views)}</b> view\n` +
    `<a href="${url}">Xem reel</a>`
  );
}