// --- Helper: safer content-type check ---
export function requireJsonContent(req, res) {
  const contentType = (req.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    res.status(415).json({ error: 'Content-Type muss application/json sein' });
    return false;
  }
  return true;
}