import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFilePath), '..');
const distDir = path.join(projectRoot, 'dist-standalone');
const sourceHtmlPath = path.join(distDir, 'index.html');
const targetDir = path.join(projectRoot, 'HTML variant');
const targetHtmlPath = path.join(targetDir, 'Diagassist_5.html');

if (!fs.existsSync(sourceHtmlPath)) {
  throw new Error(`Standalone build not found: ${sourceHtmlPath}`);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(sourceHtmlPath, targetHtmlPath);

console.log(`Standalone HTML created: ${targetHtmlPath}`);