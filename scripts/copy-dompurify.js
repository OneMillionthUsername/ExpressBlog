/* Copy DOMPurify from node_modules to public/vendor so the browser can load a local copy.
   Usage: node scripts/copy-dompurify.js
   This creates public/vendor if necessary and copies the minified file.
*/
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'dompurify', 'dist', 'purify.min.js');
const destDir = path.join(__dirname, '..', 'public', 'vendor');
const dest = path.join(destDir, 'dompurify.min.js');

function copy() {
  if (!fs.existsSync(src)) {
    console.error('Source DOMPurify not found at', src);
    console.error('Make sure you ran `npm install dompurify` in the project root.');
    process.exitCode = 2;
    return;
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(src, dest);
  console.log('Copied DOMPurify to', dest);
}

copy();
