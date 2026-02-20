import logger from '../utils/logger.js';

/**
 * Middleware für strukturiertes Request-/Access-Logging.
 * - Protokolliert eingehende Requests (Methode, URL, IP, User-Agent, Referer)
 * - Misst die Antwortzeit und schreibt einen Access-Log beim `finish`-Event
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function loggerMiddleware(req, res, next) {
  const startTime = Date.now();
  // req.ip respects Express trust proxy setting (reads X-Forwarded-For in production).
  // X-Real-IP is a single-value fallback set by Nginx (proxy_set_header X-Real-IP $remote_addr).
  // X-Forwarded-For may contain a comma-separated list; take the first (original client).
  const xForwardedFor = req.headers['x-forwarded-for'];
  const firstForwardedIp = xForwardedFor ? xForwardedFor.split(',')[0].trim() : null;
  const ip =
    firstForwardedIp ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.socket?.remoteAddress;
  // Request loggen
  // logger.debug(`Incoming request: ${req.method} ${req.url}`, {
  //   ip,
  //   userAgent: req.get('User-Agent'),
  //   referer: req.get('Referer'),
  // });
  // Response Zeit messen
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.access(req.method, req.url, res.statusCode, responseTime, ip);
  });
  next();
}

export default logger;