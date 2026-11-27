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

const NOTIFY_DATETIME_OPTS = {
  timeZone: NOTIFY_TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

/** Ngày giờ thông báo (giờ VN). */
export function formatNotifyDateTime(date = new Date()) {
  return date.toLocaleString('vi-VN', NOTIFY_DATETIME_OPTS);
}

/** Ngày giờ đăng bài từ Graph API (ms hoặc Date), giờ VN. */
export function formatPostedDateTime(msOrDate) {
  if (msOrDate == null || msOrDate === '') return '—';
  const d = typeof msOrDate === 'number' ? new Date(msOrDate) : msOrDate;
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', NOTIFY_DATETIME_OPTS);
}

export function postPreview(message, max = 80) {
  const text = message || '(Bài viết không có nội dung chữ)';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function formatMilestoneList(milestones) {
  return milestones.map((m) => formatInt(m)).join(', ');
}

/** Hiển thị ngắn cho /start, /check (tránh spam danh sách dài). */
export function formatMilestoneRanges(milestones) {
  if (!milestones?.length) return '';
  const lead = milestones.filter((m) => m < 20_000);
  const high = milestones.filter((m) => m >= 20_000);
  if (!high.length) return formatMilestoneList(milestones);
  const tail = high[high.length - 1];
  return `${formatMilestoneList(lead)}; ${formatInt(high[0])}–${formatInt(tail)} (+10K)`;
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
  postedAt,
  platform = 'Fanpage Reels',
}) {
  const link = (url || '').trim();
  const linkLine = link
    ? `• <b>Link:</b> <a href="${link.replace(/&/g, '&amp;')}">${escapeTelegramHtml(link)}</a>`
    : '• <b>Link:</b> —';

  const posted = formatPostedDateTime(postedAt);

  return (
    `🔥 <b>VIDEO ĐANG LÊN XU HƯỚNG</b>\n` +
    `• <b>Thời gian đăng:</b> ${escapeTelegramHtml(posted)}\n` +
    `• <b>Nền tảng:</b> ${escapeTelegramHtml(platform)}\n` +
    `• <b>Kênh:</b> ${escapeTelegramHtml(pageName)}\n` +
    `• <b>Video:</b> ${escapeTelegramHtml(reelTitle(title))}\n` +
    `• <b>Lượt xem:</b> ${formatInt(views)}\n` +
    `• <b>Điều kiện đạt:</b> ${escapeTelegramHtml(formatMilestoneCondition(newHits))}\n` +
    linkLine
  );
}