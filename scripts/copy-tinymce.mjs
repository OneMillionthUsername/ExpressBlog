/* Copy TinyMCE from node_modules to public/assets/js/tinymce so the browser can load a local copy.
   Usage: node scripts/copy-tinymce.mjs
   Copies tinymce.min.js plus skins, icons, themes, plugins and models directories.
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'node_modules', 'tinymce');
const destDir = path.join(__dirname, '..', 'public', 'assets', 'js', 'tinymce');

const filesToCopy = ['tinymce.min.js'];
const dirsToCopy = ['skins', 'icons', 'themes', 'plugins', 'models'];

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copy() {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (!fs.existsSync(srcDir)) {
    console.error('Source TinyMCE not found at', srcDir);
    console.error('Make sure you ran `npm install tinymce` in the project root.');
    process.exitCode = 2;
    return;
  }

  for (const file of filesToCopy) {
    const src = path.join(srcDir, file);
    const dest = path.join(destDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log('Copied', file, 'to', dest);
    } else {
      console.warn('Warning:', file, 'not found at', src);
    }
  }

  for (const dir of dirsToCopy) {
    const src = path.join(srcDir, dir);
    const dest = path.join(destDir, dir);
    if (fs.existsSync(src)) {
      copyDirRecursive(src, dest);
      console.log('Copied', dir, '/ to', dest);
    } else {
      console.warn('Warning:', dir, '/ not found at', src);
    }
  }
}

copy();
