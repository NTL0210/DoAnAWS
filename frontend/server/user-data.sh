#!/bin/bash
# ============================================================
# EC2 User Data — Voice Signaling Server (Socket.IO)
# ============================================================
# Use this script when launching an EC2 instance manually
# (or paste into EC2 console → Advanced → User Data).
#
# For CloudFormation deployment, this logic is embedded
# in the LaunchTemplate in infra/cloudformation/main-stack.yml.
#
# Prerequisites:
#   1. Security Group allows inbound on port 3001
#   2. (Optional) ALB + Target Group pointing to port 3001
#   3. Your GitHub repo URL (set REPO_URL below)
# ============================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────
# >>> CHANGE THIS to your actual repository URL <<<
REPO_URL="https://github.com/your-org/ai-meeting-workforce-platform.git"
BRANCH="main"
SIGNALING_PORT="${VOICE_SIGNALING_PORT:-3001}"
SIGNALING_DIR="/home/ec2-user/signaling"

exec > >(tee /var/log/signaling-setup.log) 2>&1
echo "[$(date)] Starting signaling server setup..."

# ── 1. Install Docker ─────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "[1/5] Installing Docker..."
  if [ -f /etc/amazon-linux-release ]; then
    # Amazon Linux 2023
    dnf install -y docker
  elif [ -f /etc/lsb-release ] || [ -f /etc/debian_version ]; then
    # Ubuntu / Debian
    apt-get update -y
    apt-get install -y docker.io
  else
    echo "Unsupported OS. Install Docker manually."
    exit 1
  fi
  systemctl enable docker
  systemctl start docker
else
  echo "[1/5] Docker already installed."
fi

# ── 2. Clone repo ─────────────────────────────────────────
echo "[2/5] Fetching signaling server code..."
if [ ! -d "$SIGNALING_DIR" ]; then
  dnf install -y git 2>/dev/null || apt-get install -y git 2>/dev/null || true
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" /tmp/repo
  mkdir -p "$SIGNALING_DIR"
  cp -r /tmp/repo/frontend/server/* "$SIGNALING_DIR/"
  rm -rf /tmp/repo
  echo "  Code copied to $SIGNALING_DIR"
else
  echo "  Already exists at $SIGNALING_DIR"
fi

# ── 3. Build Docker image ────────────────────────────────
echo "[3/5] Building Docker image..."
cd "$SIGNALING_DIR"
docker build -t voice-signaling-server .

# ── 4. Run container ─────────────────────────────────────
echo "[4/5] Starting container..."
docker rm -f signaling 2>/dev/null || true
docker run -d \
  --name signaling \
  --restart unless-stopped \
  -p "${SIGNALING_PORT}:3001" \
  -e VOICE_SIGNALING_PORT="${SIGNALING_PORT}" \
  -e NODE_ENV=production \
  voice-signaling-server

# ── 5. Verify ─────────────────────────────────────────────
echo "[5/5] Verifying health check..."
sleep 3
if curl -sf "http://localhost:${SIGNALING_PORT}/healthz" > /dev/null 2>&1; then
  echo "[OK] Signaling server is running on port ${SIGNALING_PORT}"
else
  echo "[WARN] Health check failed. Check logs: docker logs signaling"
fi

echo ""
echo "============================================"
echo "  Setup complete!"
echo "  Signaling server: http://localhost:${SIGNALING_PORT}"
echo "  Health endpoint:  http://localhost:${SIGNALING_PORT}/healthz"
echo "============================================"
