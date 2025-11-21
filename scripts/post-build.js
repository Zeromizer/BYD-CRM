#!/usr/bin/env node

/**
 * Post-build script for GitHub Pages deployment
 *
 * This script runs after `vite build` to prepare files for GitHub Pages:
 * 1. Copies dist/index.html to root index.html
 * 2. Copies dist/assets/* to root assets/ folder
 *
 * GitHub Pages serves from the repository root, so we need to ensure
 * built assets are available at the paths referenced in index.html.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const rootAssetsDir = path.join(rootDir, 'assets');

console.log('\n📦 Post-build: Preparing files for GitHub Pages deployment...\n');

// Step 1: Copy dist/index.html to root
try {
  const indexSource = path.join(distDir, 'index.html');
  const indexDest = path.join(rootDir, 'index.html');

  fs.copyFileSync(indexSource, indexDest);
  console.log('✓ Copied dist/index.html → index.html');
} catch (error) {
  console.error('✗ Failed to copy index.html:', error.message);
  process.exit(1);
}

// Step 2: Ensure root assets directory exists
if (!fs.existsSync(rootAssetsDir)) {
  fs.mkdirSync(rootAssetsDir, { recursive: true });
  console.log('✓ Created assets/ directory');
}

// Step 3: Copy all files from dist/assets/ to root assets/
try {
  const files = fs.readdirSync(distAssetsDir);
  let copiedCount = 0;

  files.forEach(file => {
    const source = path.join(distAssetsDir, file);
    const dest = path.join(rootAssetsDir, file);

    // Only copy files, not directories
    if (fs.statSync(source).isFile()) {
      fs.copyFileSync(source, dest);
      copiedCount++;
    }
  });

  console.log(`✓ Copied ${copiedCount} asset file(s) from dist/assets/ → assets/`);
} catch (error) {
  console.error('✗ Failed to copy assets:', error.message);
  process.exit(1);
}

console.log('\n✅ Post-build complete! Files ready for GitHub Pages deployment.\n');
