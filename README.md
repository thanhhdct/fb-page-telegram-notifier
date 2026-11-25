# FB Page → Telegram Notifier

Gửi Telegram khi **có tin nhắn mới** trên Page hoặc khi bài viết chạm mốc **500 / 1K / 5K / 10K view** (`post_media_view`).

Hỗ trợ **deploy Vercel** (serverless + Cron) hoặc chạy local bằng Express.

## Yêu cầu

- Node.js 18+
- [Meta App](https://developers.facebook.com/) (Page / Messenger)
- Bot Telegram ([@BotFather](https://t.me/BotFather))
- **Vercel:** [Upstash Redis](https://vercel.com/marketplace?category=storage&search=redis) (lưu `state` + lock quét view)

## Biến môi trường

| Biến | Mô tả |
|------|--------|
| `FB_LONG_USER_TOKEN` | User access token dài hạn |
| `FB_VERIFY_TOKEN` | Token verify webhook Meta |
| `TG_BOT_TOKEN` | Token bot Telegram |
| `TG_CHAT_ID` | Chat nhận thông báo |
| `PUBLIC_BASE_URL` | `https://<app>.vercel.app` — dùng set webhook Telegram |
| `CRON_SECRET` | Bảo vệ route cron (Vercel tự gửi `Bearer` khi chạy cron) |

Redis: Vercel **Marketplace → Upstash Redis** → Connect project → `UPSTASH_REDIS_REST_*` tự gán.

## Deploy Vercel (khuyến nghị)

1. Import repo [thanhhdct/fb-page-telegram-notifier](https://github.com/thanhhdct/fb-page-telegram-notifier) trên [vercel.com](https://vercel.com).
2. **Storage → Create Database → KV** → Connect vào project.
3. **Settings → Environment Variables:** các biến ở trên + `CRON_SECRET` (chuỗi ngẫu nhiên).
4. Deploy.
5. Facebook webhook: `https://<app>.vercel.app/webhook`
6. Telegram:

```bash
# .env: PUBLIC_BASE_URL + TG_BOT_TOKEN
npm run telegram:set-webhook
```

### Endpoint

| Path | Việc |
|------|------|
| `GET/POST /webhook` | Verify + tin nhắn Page (Meta) |
| `POST /telegram` | Lệnh bot (`/check`, `/start`) |
| `GET /health` | Kiểm tra nhanh |
| `/api/cron/check-views` | Quét mốc view (Cron) |

Cron trong `vercel.json`: mỗi 5 phút. **Gói Hobby** có giới hạn cron — nếu không chạy đủ dày, dùng Pro hoặc [cron-job.org](https://cron-job.org) gọi:

`GET https://<app>.vercel.app/api/cron/check-views`  
Header: `Authorization: Bearer <CRON_SECRET>`

## Chạy local

```bash
cp .env.example .env
npm install
npm start          # Express + interval (không cần KV, dùng state.json)
npm run vercel:dev # Giống production serverless
```

## Facebook Webhook

1. App → **Webhooks** → **Page** → Callback `https://<host>/webhook`
2. Verify token = `FB_VERIFY_TOKEN`
3. Subscribe **messages**

## Lệnh Telegram

- `/check` — quét 500 / 1k ngay  
- `/start` — hướng dẫn

## License

MIT