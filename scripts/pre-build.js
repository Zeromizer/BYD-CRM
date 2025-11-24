#!/usr/bin/env node

/**
 * Pre-build script to ensure index.html has source reference
 *
 * This script runs before `vite build` to ensure index.html
 * references /src/main.jsx instead of built assets, allowing
 * the build to succeed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');

console.log('\n🔧 Pre-build: Preparing index.html for build...\n');

try {
  let content = fs.readFileSync(indexPath, 'utf8');

  // Check if index.html has hardcoded asset references
  const hasHardcodedAssets = content.includes('/BYD-CRM/assets/index-') &&
                              content.includes('<script type="module" crossorigin src="/BYD-CRM/assets/');

  if (hasHardcodedAssets) {
    console.log('⚠️  Found hardcoded asset references, fixing...');

    // Replace hardcoded assets with source reference
    content = content.replace(
      /\s*<script type="module" crossorigin src="\/BYD-CRM\/assets\/index-[^"]+\.js"><\/script>\s*<link rel="stylesheet" crossorigin href="\/BYD-CRM\/assets\/index-[^"]+\.css">/g,
      '\n    <script type="module" src="/src/main.jsx"></script>'
    );

    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('✓ Updated index.html with source reference');
  } else {
    console.log('✓ index.html already has source reference');
  }
} catch (error) {
  console.error('✗ Failed to prepare index.html:', error.message);
  process.exit(1);
}

console.log('✅ Pre-build complete!\n');
