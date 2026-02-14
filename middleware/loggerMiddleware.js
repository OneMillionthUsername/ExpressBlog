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
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
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