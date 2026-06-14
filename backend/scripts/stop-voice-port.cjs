const { execFileSync } = require('child_process');

const port = process.env.VOICE_SIGNALING_PORT || process.env.PORT || '3001';

function getListeningPids() {
  const output = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
  return Array.from(new Set(
    output
      .split(/\r?\n/)
      .filter((line) => line.includes(`:${port}`) && line.includes('LISTENING'))
      .map((line) => line.trim().split(/\s+/).at(-1))
      .filter(Boolean)
  ));
}

const pids = getListeningPids();

if (pids.length === 0) {
  console.log(`[Voice] No process is listening on port ${port}.`);
  process.exit(0);
}

pids.forEach((pid) => {
  console.log(`[Voice] Stopping PID ${pid} on port ${port}.`);
  execFileSync('taskkill', ['/PID', pid, '/F'], { stdio: 'inherit' });
});
