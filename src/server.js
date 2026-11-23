require('dotenv').config({ quiet: true });
const app = require('./app');
const db = require('./db');

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1-65535.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Copy .env.example to .env.');
let server;
async function start() {
  await db.$connect();
  server = app.listen(port, () => console.log(`API: http://localhost:${port} | Swagger: http://localhost:${port}/docs`));
  server.on('error', async err => { console.error(err.message); await db.$disconnect(); process.exitCode = 1; });
}
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timer = setTimeout(() => process.exit(1), 10000).unref();
  if (server) await new Promise(resolve => server.close(resolve));
  await db.$disconnect();
  clearTimeout(timer);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
start().catch(async err => { console.error(err.message); await db.$disconnect(); process.exitCode = 1; });
