import { isIP } from 'node:net';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const READ_PATHS = new Set(['/transfers/status', '/accounts/activity', '/accounts/balances', '/health']);

/** Only the local reverse proxy may supply a client IP, and it must overwrite this header. */
export function clientAddress(request, trustLoopbackProxy = false) {
  const peer = request.socket.remoteAddress || 'unknown';
  const forwarded = request.headers['x-real-ip'];
  return trustLoopbackProxy && LOOPBACK.has(peer) && typeof forwarded === 'string' && isIP(forwarded)
    ? forwarded
    : peer;
}

export function createRequestLimiter({ trustLoopbackProxy = false, now = Date.now } = {}) {
  const clients = new Map();
  return (request) => {
    const time = now();
    for (const [key, values] of clients) if (time - values.at(-1) >= 60_000) clients.delete(key);
    const read = READ_PATHS.has(new URL(request.url || '/', 'http://localhost').pathname);
    const key = `${clientAddress(request, trustLoopbackProxy)}:${read ? 'read' : 'write'}`;
    const values = (clients.get(key) || []).filter((stamp) => time - stamp < 60_000);
    if (values.length >= (read ? 60 : 12)) return false;
    values.push(time);
    clients.set(key, values);
    return true;
  };
}
