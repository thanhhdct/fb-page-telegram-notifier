import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out =
  process.argv[2] ||
  path.join(root, '..', '..', '.cursor', 'projects', 'c-Users-Admin-Projects-private-crown', 'agent-tools', 'vercel-deploy-body.json');

const list = [
  '.env.example',
  '.gitignore',
  'README.md',
  'api/cron/check-views.js',
  'api/health.js',
  'api/telegram.js',
  'api/webhook.js',
  'lib/config.js',
  'lib/facebook.js',
  'lib/format.js',
  'lib/pageMessages.js',
  'lib/redis.js',
  'lib/state.js',
  'lib/telegram.js',
  'lib/viewMilestones.js',
  'package-lock.json',
  'package.json',
  'scripts/set-telegram-webhook.js',
  'src/index.js',
  'vercel.json',
];

const files = list.map((f) => ({
  file: f,
  data: fs.readFileSync(path.join(root, f), 'utf8'),
  encoding: 'utf-8',
}));

const body = {
  name: 'fb-page-telegram-notifier',
  project: 'fb-page-telegram-notifier',
  target: 'production',
  projectSettings: {
    framework: null,
    installCommand: 'npm install',
    buildCommand: null,
    outputDirectory: null,
  },
  files,
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(body));
console.log(JSON.stringify({ files: files.length, bytes: Buffer.byteLength(JSON.stringify(body)) }));