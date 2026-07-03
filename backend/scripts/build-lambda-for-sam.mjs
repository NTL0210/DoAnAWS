#!/usr/bin/env node

/**
 * Build Lambda for SAM Deployment
 *
 * Prepares the ai-processing Lambda directory for SAM's `sam build`:
 *   1. Copies source + shared module + dynamodb helpers
 *   2. Creates package.json with required AWS SDK dependencies
 *   3. Keeps the output directory (no ZIP, no cleanup)
 *
 * SAM's CodeUri then points to the output directory.
 *
 * Usage:
 *   node scripts/build-lambda-for-sam.mjs
 *
 * Output: backend/dist/lambdas/ai-processing-sam/
 *
 * @module scripts/build-lambda-for-sam
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(__dirname, '..');
const LAMBDA_SRC = join(BACKEND_ROOT, 'lambdas', 'ai-processing');
const SHARED_SRC = join(BACKEND_ROOT, 'lambdas', 'shared');
const DYNAMODB_SRC = join(BACKEND_ROOT, 'src', 'dynamodb');
const OUT_DIR = join(BACKEND_ROOT, 'dist', 'lambdas', 'ai-processing-sam');

async function main() {
  console.log('\n📦 Building ai-processing Lambda for SAM deployment...');

  // Clean output directory
  if (existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. Copy Lambda handler files
  copyFiles(LAMBDA_SRC, OUT_DIR);

  // 2. Copy shared module (summaryNotification.js + dependencies)
  const sharedDest = join(OUT_DIR, 'shared');
  mkdirSync(sharedDest, { recursive: true });
  copyFiles(SHARED_SRC, sharedDest);

  // 3. Copy DynamoDB entity types (needed by shared module)
  const dynamodbDest = join(OUT_DIR, 'dynamodb');
  mkdirSync(dynamodbDest, { recursive: true });
  copyFiles(DYNAMODB_SRC, dynamodbDest);

  // 4. Create package.json with Lambda dependencies
  const lambdaPackage = {
    name: '@ai-meeting/lambda-ai-processing',
    version: '0.1.0',
    private: true,
    type: 'module',
    dependencies: {
      '@aws-sdk/client-dynamodb': '^3.705.0',
      '@aws-sdk/client-s3': '^3.705.0',
      '@aws-sdk/client-transcribe': '^3.705.0',
    },
  };
  writeFileSync(join(OUT_DIR, 'package.json'), JSON.stringify(lambdaPackage, null, 2));

  // 5. Install production dependencies
  console.log('   Installing dependencies...');
  execSync('npm install --omit=dev --no-audit --no-fund', {
    cwd: OUT_DIR,
    stdio: 'inherit',
  });

  // Count total size
  let totalSize = 0;
  function countSize(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') countSize(full);
      } else if (entry.isFile()) {
        totalSize += statSync(full).size;
      }
    }
  }
  countSize(OUT_DIR);
  const sizeMB = (totalSize / 1024 / 1024).toFixed(1);

  console.log(`   ✅ Lambda prepared at: ${OUT_DIR}`);
  console.log(`   📦 Size: ~${sizeMB} MB (with dependencies)`);
  console.log(`   📌 Point SAM CodeUri to: dist/lambdas/ai-processing-sam/\n`);
}

function copyFiles(srcDir, destDir) {
  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      mkdirSync(destPath, { recursive: true });
      copyFiles(srcPath, destPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.json'))) {
      cpSync(srcPath, destPath);
    }
  }
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
