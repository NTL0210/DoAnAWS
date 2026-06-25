/**
 * Deploy Script — Deploys CloudFormation stack and Lambda artifacts
 *
 * Usage:
 *   node scripts/deploy.mjs                    # Deploy dev stack
 *   node scripts/deploy.mjs --env staging      # Deploy to staging
 *   node scripts/deploy.mjs --env prod         # Deploy to production
 *
 * Prerequisites:
 *   - AWS CLI installed and configured
 *   - AWS credentials with sufficient permissions
 *   - Environment variables set in .env.production (or .env)
 *
 * @module scripts/deploy
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
const ENV_FLAG = args.find((a) => a.startsWith('--env=')) || '--env=dev';
const ENVIRONMENT = ENV_FLAG.split('=')[1] || 'dev';
const STACK_NAME = `ai-meeting-stack-${ENVIRONMENT}`;

console.log(`\n🚀 Deploying AI Meeting Workforce Platform`);
console.log(`   Environment: ${ENVIRONMENT}`);
console.log(`   Stack Name:  ${STACK_NAME}\n`);

async function main() {
  const startTime = Date.now();

  // 1. Build Lambda packages
  console.log('📦 Step 1: Building Lambda ZIPs...');
  execSync('node scripts/build-lambdas.mjs', { cwd: BACKEND_ROOT, stdio: 'inherit' });

  // 2. Upload Lambda ZIPs to S3
  const artifactBucket = getArtifactBucket();
  console.log(`\n📤 Step 2: Uploading Lambdas to S3 (${artifactBucket})...`);
  ensureBucketExists(artifactBucket);

  const lambdaNames = ['auth', 'users', 'meetings', 'tasks', 'ai-processing'];
  for (const name of lambdaNames) {
    const zipPath = join(BACKEND_ROOT, 'dist', 'lambdas', `${name}.zip`);
    if (!existsSync(zipPath)) {
      console.error(`   ❌ ${name}.zip not found — skipping`);
      continue;
    }
    execSync(
      `aws s3 cp "${zipPath}" "s3://${artifactBucket}/lambdas/${name}.zip"`,
      { stdio: 'inherit' }
    );
    console.log(`   ✅ ${name}.zip uploaded`);
  }

  // 3. Deploy CloudFormation stack
  console.log(`\n📋 Step 3: Deploying CloudFormation stack...`);
  const templatePath = join(BACKEND_ROOT, 'infra', 'cloudformation', 'main-stack.yml');
  if (!existsSync(templatePath)) {
    console.error(`   ❌ Template not found at ${templatePath}`);
    process.exit(1);
  }

  const deployCmd = [
    'aws cloudformation deploy',
    `--template-file "${templatePath}"`,
    `--stack-name ${STACK_NAME}`,
    `--parameter-overrides Environment=${ENVIRONMENT}`,
    '--capabilities CAPABILITY_NAMED_IAM',
    '--no-fail-on-empty-changeset',
  ].join(' ');

  execSync(deployCmd, { stdio: 'inherit' });

  // 4. Get stack outputs
  console.log(`\n🔍 Getting stack outputs...`);
  const outputsCmd = `aws cloudformation describe-stacks --stack-name ${STACK_NAME} --query "Stacks[0].Outputs" --output table`;
  execSync(outputsCmd, { stdio: 'inherit' });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Deployment complete! (${elapsed}s)`);
  console.log(`   Stack: ${STACK_NAME}`);
  console.log(`   Region: ${process.env.AWS_REGION || 'ap-southeast-1'}`);
}

/**
 * Get the artifact bucket name for Lambda ZIPs.
 */
function getArtifactBucket() {
  const accountId = execSync(
    'aws sts get-caller-identity --query Account --output text',
    { encoding: 'utf-8' }
  ).trim();
  return `ai-meeting-lambda-${accountId}-${ENVIRONMENT}`;
}

/**
 * Ensure the artifact bucket exists, creating it if necessary.
 */
function ensureBucketExists(bucket) {
  try {
    execSync(`aws s3 ls "s3://${bucket}"`, { stdio: 'pipe' });
    console.log(`   Bucket ${bucket} already exists.`);
  } catch {
    console.log(`   Creating bucket ${bucket}...`);
    const region = process.env.AWS_REGION || 'ap-southeast-1';
    execSync(
      `aws s3 mb "s3://${bucket}" --region ${region}`,
      { stdio: 'inherit' }
    );
  }
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});
