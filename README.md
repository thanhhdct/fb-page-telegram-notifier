# FB Page → Telegram Notifier

Server Node.js nhỏ: gửi Telegram khi **có tin nhắn mới** trên bất kỳ Facebook Page nào bạn quản lý, và khi **bài viết đạt 500 hoặc 1.000 view** (metric `post_media_view`).

## Yêu cầu

- Node.js 18+
- URL **HTTPS** công khai (Railway, Render, VPS + nginx, ngrok khi dev…)
- [Meta App](https://developers.facebook.com/) với quyền Page / Messenger
- Bot Telegram ([@BotFather](https://t.me/BotFather))

## Cấu hình nhanh

```bash
cp .env.example .env
# Sửa .env
npm install
npm start
```

### Biến môi trường

| Biến | Mô tả |
|------|--------|
| `FB_LONG_USER_TOKEN` | User access token dài hạn |
| `FB_VERIFY_TOKEN` | Chuỗi tự đặt, khớp khi subscribe Webhook trên Meta |
| `TG_BOT_TOKEN` | Token bot Telegram |
| `TG_CHAT_ID` | Chat nhận thông báo mặc định |
| `PUBLIC_BASE_URL` | Dùng cho `npm run telegram:set-webhook` |
| `CHECK_INTERVAL_MINUTES` | Chu kỳ quét view (mặc định 5; `0` = tắt) |

### Facebook Webhook

1. App → **Webhooks** → Object **Page** → Callback: `https://<host>/webhook`
2. Verify token = `FB_VERIFY_TOKEN`
3. Subscribe: **messages** (và các field cần cho Page bạn dùng)
4. User token cần quyền đọc Page / insights tương ứng

### Telegram Webhook (lệnh `/check`)

```bash
npm run telegram:set-webhook
```

Hoặc gọi API:

`https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<host>/telegram`

### Lệnh Telegram

- `/check` — quét mốc 500 / 1k view ngay
- `/start` — hướng dẫn ngắn

## Deploy gợi ý

- **Railway / Render**: set env vars, expose port `PORT`, chạy `npm start`
- Dev local: `ngrok http 3000` → dùng URL ngrok cho Meta + Telegram webhook

## License

MIT