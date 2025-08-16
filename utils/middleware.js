import path from "path";
import escapeAllStrings, * as utils from ".utils.js"

// --- Helper: safer content-type check ---
export function requireJsonContent(req, res, next) {
  const contentType = (req.get("content-type") || "").toLowerCase();

  if (!contentType.startsWith("application/json")) {
    return res
      .status(415)
      .json({ error: "Content-Type muss application/json sein" });
  }

  next(); // alles ok → nächste Middleware / Route
}

/**
 * Factory to create middleware
 * @param {string[]} whitelist - names of fields that contain HTML (e.g. ['content'])
 */
export function createEscapeInputMiddleware(whitelist = []) {
  return function escapeInputMiddleware(req, res, next) {
    try {
      req.body = escapeAllStrings(req.body, whitelist);
      req.query = escapeAllStrings(req.query, whitelist);
      req.params = escapeAllStrings(req.params, whitelist);
      if(req.cookies) req.cookies = escapeAllStrings(req.cookies, whitelist);
      const safeHeaders = ["user-agent", "referer"];
      safeHeaders.forEach(h => {
        if (req.headers[h]) {
          req.headers[h] = escapeAllStrings(req.headers[h], whitelist);
        }
      });
      // File-Uploads: nur die Originalnamen escapen
      if (req.file) {
        req.file.safeFilename = utils.sanitizeFilename(req.file.originalname);
      }
      if (req.files) {
        req.files.forEach(f => {
          f.safeFilename = utils.sanitizeFilename(f.originalname);
        });
      }
    } catch (err) {
      // don't crash the server because of bad input
      console.error('Error in escapeInputMiddleware:', err);
    }
    next();
  };
}

// --- error handler (production-safe) ---
export function errorHandlerMiddleware(err, req, res, next) {
  logger.error(err); // internal logging only
  res.status(500).json({ error: 'Internal Server Error' });
}