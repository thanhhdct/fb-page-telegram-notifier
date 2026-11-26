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

/** Giờ đăng bài (ms từ Graph hoặc Date); không có thì "—". */
export function formatPostedDateTime(createdAt) {
  if (createdAt == null || createdAt === 0) return '—';
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '—';
  return formatNotifyDateTime(d);
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

function truncateDebugTitle(text, max = 48) {
  const t = (text || '(không tiêu đề)').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Báo cáo /check: bài quét, view API, mốc đã lưu (tách nhiều tin nếu dài). */
export function buildCheckDebugMessages(byPage) {
  const header =
    '📋 <b>Chi tiết quét</b> (reel + post, mới nhất)\n' +
    '<i>view = post_media_view; mốc đã báo = Redis/state</i>';

  if (!byPage.length) {
    return [`${header}\n\n(Không quét được bài nào.)`];
  }

  const chunks = [];
  let block = header;

  const appendLine = (line) => {
    const next = block ? `${block}\n${line}` : line;
    if (next.length > 3600) {
      chunks.push(block);
      block = line;
    } else {
      block = next;
    }
  };

  for (const section of byPage) {
    appendLine('');
    appendLine(`<b>${escapeTelegramHtml(section.pageName)}</b> (${section.items.length} bài)`);
    for (const it of section.items) {
      const done =
        it.doneList?.length > 0 ? formatMilestoneList(it.doneList) : '—';
      const hits = it.newHits?.length > 0 ? formatMilestoneList(it.newHits) : '—';
      const err = it.viewError ? ` ⚠️ ${escapeTelegramHtml(it.viewError)}` : '';
      const src = it.source === 'post' ? 'post' : 'reel';
      const posted = formatPostedDateTime(it.created_time);
      appendLine(
        `• ${escapeTelegramHtml(truncateDebugTitle(it.title))} [${src}]\n` +
          `  id <code>${escapeTelegramHtml(it.id)}</code>\n` +
          `  đăng: <b>${escapeTelegramHtml(posted)}</b>\n` +
          `  view API: <b>${formatInt(it.views)}</b>${err}\n` +
          `  đã báo: ${done} | mốc mới: ${hits}`
      );
    }
  }

  if (block) chunks.push(block);
  return chunks.length ? chunks : [header];
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