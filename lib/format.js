const NOTIFY_TZ = 'Asia/Ho_Chi_Minh';

export function escapeTelegramHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

function formatMilestoneCondition(newHits) {
  if (!newHits?.length) return 'Đạt mốc view';
  if (newHits.length === 1) return `Đạt mốc ${formatInt(newHits[0])} view`;
  return `Đạt mốc ${formatMilestoneList(newHits)} view`;
}

/** Tin báo mốc view (HTML Telegram) — format "VIDEO ĐANG LÊN XU HƯỚNG". */
export function formatMilestoneAlert({
  pageName,
  title,
  newHits,
  views,
  url,
  platform = 'Fanpage Reels',
}) {
  const link = (url || '').trim();
  const linkLine = link
    ? `• <b>Link:</b> <a href="${link.replace(/&/g, '&amp;')}">${escapeTelegramHtml(link)}</a>`
    : '• <b>Link:</b> —';

  const when = formatNotifyDateTime();

  return (
    `🔥 <b>VIDEO ĐANG LÊN XU HƯỚNG</b>\n` +
    `• <b>Thời gian:</b> ${escapeTelegramHtml(when)}\n` +
    `• <b>Nền tảng:</b> ${escapeTelegramHtml(platform)}\n` +
    `• <b>Kênh:</b> ${escapeTelegramHtml(pageName)}\n` +
    `• <b>Video:</b> ${escapeTelegramHtml(reelTitle(title))}\n` +
    `• <b>Lượt xem:</b> ${formatInt(views)}\n` +
    `• <b>Điều kiện đạt:</b> ${escapeTelegramHtml(formatMilestoneCondition(newHits))}\n` +
    linkLine
  );
}