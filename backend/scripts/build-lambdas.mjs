#!/usr/bin/env node

/**
 * Lambda Build Script — packages each Lambda function into a deployable ZIP
 *
 * Usage:
 *   node scripts/build-lambdas.mjs            # Build all Lambdas
 *   node scripts/build-lambdas.mjs users      # Build specific Lambda
 *
 * Output: backend/dist/lambdas/<name>.zip
 *
 * Each Lambda ZIP includes:
 *   - The Lambda handler code (index.js + controller.js)
 *   - Shared modules (../shared/*)
 *   - DynamoDB repository code (../../src/dynamodb/*)
 *   - Shared dependencies from node_modules (pruned)
 *
 * @module scripts/build-lambdas
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, cpSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(__dirname, '..');
const LAMBDAS_DIR = join(BACKEND_ROOT, 'lambdas');
const DIST_DIR = join(BACKEND_ROOT, 'dist', 'lambdas');

// Lambda functions to package
const LAMBDA_ENTRIES = ['auth', 'users', 'meetings', 'tasks', 'ai-processing'];

async function main() {
  const target = process.argv[2]; // optional: build only one

  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  const toBuild = target
    ? [target]
    : LAMBDA_ENTRIES;

  for (const name of toBuild) {
    if (!LAMBDA_ENTRIES.includes(name)) {
      console.error(`Unknown Lambda: ${name}. Available: ${LAMBDA_ENTRIES.join(', ')}`);
      process.exit(1);
    }
    await buildLambda(name);
  }

  console.log('\n✅ All Lambdas built successfully!');
  console.log(`   Output: ${DIST_DIR}`);
}

async function buildLambda(name) {
  const lambdaDir = join(LAMBDAS_DIR, name);
  const buildDir = join(DIST_DIR, name);
  const zipPath = join(DIST_DIR, `${name}.zip`);

  console.log(`\n📦 Building Lambda: ${name}...`);

  // Clean build directory
  if (existsSync(buildDir)) {
    rmSync(buildDir, { recursive: true });
  }
  mkdirSync(buildDir, { recursive: true });

  // Copy Lambda handler files
  copyFiles(lambdaDir, buildDir, (file) =>
    file.endsWith('.js') || file.endsWith('.json')
  );

  // Copy shared modules (relative imports like '../shared/...' or '../../src/...')
  const sharedSrc = join(LAMBDAS_DIR, 'shared');
  const sharedDest = join(buildDir, 'shared');
  if (existsSync(sharedSrc)) {
    mkdirSync(sharedDest, { recursive: true });
    copyFiles(sharedSrc, sharedDest);
  }

  // Copy DynamoDB repository code
  const repoSrc = join(BACKEND_ROOT, 'src', 'dynamodb');
  const repoDest = join(buildDir, 'dynamodb');
  if (existsSync(repoSrc)) {
    mkdirSync(repoDest, { recursive: true });
    copyFiles(repoSrc, repoDest);
  }

  // Create minimal package.json for the Lambda
  const lambdaPackage = {
    name: `@ai-meeting/lambda-${name}`,
    version: '0.1.0',
    private: true,
    type: 'module',
    dependencies: {
      '@aws-sdk/client-dynamodb': '^3.705.0',
      '@aws-sdk/lib-dynamodb': '^3.705.0',
      '@aws-sdk/client-s3': '^3.705.0',
      '@aws-sdk/client-transcribe': '^3.705.0',
      '@aws-sdk/client-bedrock-runtime': '^3.705.0',
      '@aws-sdk/client-cognito-identity-provider': '^3.705.0',
    },
  };
  writeFileSync(join(buildDir, 'package.json'), JSON.stringify(lambdaPackage, null, 2));

  // Install dependencies (production only)
  console.log(`   Installing dependencies for ${name}...`);
  execSync('npm install --omit=dev --no-audit --no-fund', {
    cwd: buildDir,
    stdio: 'pipe',
  });

  // Create ZIP
  console.log(`   Creating ZIP: ${basename(zipPath)}`);
  if (existsSync(zipPath)) rmSync(zipPath);

  // Use system zip or 7z
  try {
    execSync(`powershell -Command "Compress-Archive -Path '${buildDir}\\*' -DestinationPath '${zipPath}' -Force"`, {
      stdio: 'pipe',
      timeout: 30000,
    });
  } catch {
    // Fallback to npm's archiver if available
    execSync(`npx -y bestzip "${zipPath}" "${buildDir}\\*"`, {
      cwd: BACKEND_ROOT,
      stdio: 'pipe',
    });
  }

  const stats = existsSync(zipPath) ? `(${(readdirSync(DIST_DIR).length / 1024 / 1024).toFixed(1)} MB)` : '';
  console.log(`   ✅ ${name}.zip created ${stats}`);

  // Clean up build directory (keep only ZIP)
  rmSync(buildDir, { recursive: true });
}

/**
 * Recursively copy files from src to dest, optionally filtered by predicate.
 */
function copyFiles(srcDir, destDir, filterFn = () => true) {
  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      mkdirSync(destPath, { recursive: true });
      copyFiles(srcPath, destPath, filterFn);
    } else if (entry.isFile() && filterFn(entry.name)) {
      cpSync(srcPath, destPath);
    }
  }
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
