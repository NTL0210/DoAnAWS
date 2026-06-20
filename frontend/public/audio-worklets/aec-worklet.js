/**
 * AEC (Acoustic Echo Cancellation) AudioWorkletProcessor
 *
 * Implements NLMS adaptive filter + Geigel double-talk detection,
 * ported from OmniVoice-Studio's aec.py (MIT-licensed approach).
 *
 * Algorithm:
 *   NLMS: w[n+1] = w[n] + mu * e[n] * x[n] / (||x[n]||^2 + epsilon)
 *   Geigel: |near| > rho * max(|far|) → double-talk → freeze adaptation
 *
 * @class EchoCancellationProcessor
 * @extends AudioWorkletProcessor
 */
class EchoCancellationProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);

    // ─── Configuration ────────────────────────────────────
    this.tapCount = options?.processorOptions?.tapCount || 512;   /* ~32ms at 16kHz */
    this.warmupStep = options?.processorOptions?.warmupStep || 0.5;
    this.steadyStep = options?.processorOptions?.steadyStep || 0.1;
    this.warmupDuration = options?.processorOptions?.warmupDuration || 0.5; /* seconds */
    this.rho = options?.processorOptions?.rho || 2.0;   /* Geigel threshold ratio */
    this.stalenessMs = options?.processorOptions?.stalenessMs || 250;
    this.leakage = options?.processorOptions?.leakage || 0.9999;

    // ─── Filter state ────────────────────────────────────
    this.weights = new Float32Array(this.tapCount);       /* adaptive filter taps */
    this.farBuffer = new Float32Array(this.tapCount * 2);  /* ring buffer for far-end */
    this.farWriteIdx = 0;

    // ─── Step scheduling ─────────────────────────────────
    this.startFrame = currentFrame;
    this.sampleRate = sampleRate;
    this.warmupFrames = Math.round(this.warmupDuration * sampleRate);

    // ─── Geigel double-talk state ────────────────────────
    this.farPeak = 0;
    this.farPeakDecay = 0.999;
    this.nearPeak = 0;
    this.nearPeakDecay = 0.999;
    this.lastFarPushFrame = 0;

    // ─── Stats ────────────────────────────────────────────
    this.erle = 0;         /* Echo Return Loss Enhancement (dB) */
    this.nearEnergy = 0;
    this.errorEnergy = 0;
    this.statsCounter = 0;

    // ─── Message handling ─────────────────────────────────
    this.port.onmessage = (event) => {
      if (event.data?.type === 'push-far') {
        this.pushFarEnd(event.data.samples);
      }
    };

    // Signal ready
    this.port.postMessage({ type: 'ready', taps: this.tapCount });
  }

  /**
   * Push far-end (playback) samples into the reference buffer.
   * Called from main thread via worklet.port.postMessage.
   *
   * @param {Float32Array} samples
   */
  pushFarEnd(samples) {
    if (!samples || samples.length === 0) return;
    this.lastFarPushFrame = currentFrame;

    for (let i = 0; i < samples.length; i++) {
      this.farBuffer[this.farWriteIdx] = samples[i];
      this.farWriteIdx = (this.farWriteIdx + 1) % this.farBuffer.length;
    }
  }

  /**
   * Read far-end samples from the ring buffer, reading `count` samples
   * ending at the given offset (in reverse order since the oldest sample
   * is originally at the front of the filter).
   *
   * @param {number} count — number of samples to read
   * @returns {Float32Array}
   */
  readFarBuffer(count) {
    const out = new Float32Array(count);
    let idx = (this.farWriteIdx - 1 + this.farBuffer.length) % this.farBuffer.length;
    for (let i = count - 1; i >= 0; i--) {
      out[i] = this.farBuffer[idx];
      idx = (idx - 1 + this.farBuffer.length) % this.farBuffer.length;
    }
    return out;
  }

  /**
   * Get current step size based on adaptation phase.
   * @returns {number}
   */
  getStepSize() {
    const framesSinceStart = currentFrame - this.startFrame;
    return framesSinceStart < this.warmupFrames ? this.warmupStep : this.steadyStep;
  }

  /**
   * Geigel double-talk detection.
   * @param {number} nearSample — current near-end (mic) sample
   * @param {number} farMagnitude — peak magnitude of far-end buffer
   * @returns {boolean} true if double-talk is detected (freeze adaptation)
   */
  isDoubleTalk(nearSample, farMagnitude) {
    const nearAbs = Math.abs(nearSample);
    const farAbs = Math.abs(farMagnitude);

    // Update peaks with decay
    this.farPeak = Math.max(farAbs, this.farPeak * this.farPeakDecay);
    this.nearPeak = Math.max(nearAbs, this.nearPeak * this.nearPeakDecay);

    // Geigel test: near > rho * far => double-talk
    if (this.farPeak > 1e-6 && nearAbs > this.rho * this.farPeak) {
      return true;
    }
    return false;
  }

  /**
   * Check if far-end reference is stale (no samples pushed recently).
   * @returns {boolean}
   */
  isFarStale() {
    const framesSincePush = currentFrame - this.lastFarPushFrame;
    return framesSincePush > (this.sampleRate * this.stalenessMs / 1000);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length || !output || !output.length) {
      return true;
    }

    const nearChannel = input[0];
    const outputChannel = output[0];

    if (!nearChannel || !outputChannel) return true;

    const len = Math.min(nearChannel.length, outputChannel.length);

    // ─── Fast path: no far-end reference → passthrough ──
    if (this.isFarStale()) {
      outputChannel.set(nearChannel.subarray(0, len));
      return true;
    }

    // ─── Read corresponding far-end samples ──────────────
    const farSamples = this.readFarBuffer(len);

    // ─── Compute far-end magnitude for Geigel ────────────
    let farMax = 0;
    for (let i = 0; i < len; i++) {
      const abs = Math.abs(farSamples[i]);
      if (abs > farMax) farMax = abs;
    }

    const mu = this.getStepSize();
    let sumNearEnergy = 0;
    let sumErrorEnergy = 0;

    // ─── Sample-by-sample NLMS processing ────────────────
    // Optimization note: a block-update NLMS (process per-frame instead of
    // per-sample) would be more efficient, but per-sample yields better
    // convergence for the same tap count.
    for (let s = 0; s < len; s++) {
      const nearSample = nearChannel[s];

      // Check for silence (near ≤ -60dBFS) — skip adaptation
      if (Math.abs(nearSample) < 0.001) {
        outputChannel[s] = nearSample;
        continue;
      }

      // Build far-end feature vector (most recent taps samples)
      let estimatedEcho = 0;
      let farEnergy = 1e-6;
      let farIdx = (this.farWriteIdx - this.tapCount + s + this.farBuffer.length) % this.farBuffer.length;
      for (let t = 0; t < this.tapCount; t++) {
        const fIdx = (farIdx + t) % this.farBuffer.length;
        const farVal = this.farBuffer[fIdx];
        estimatedEcho += this.weights[t] * farVal;
        farEnergy += farVal * farVal;
      }

      // Error signal: near - estimated echo
      const errorSignal = nearSample - estimatedEcho;

      // Update ERLE estimate (smoothed)
      sumNearEnergy += nearSample * nearSample;
      sumErrorEnergy += errorSignal * errorSignal;

      // NLMS update (only if not double-talk)
      const dt = this.isDoubleTalk(nearSample, farMax);
      if (!dt) {
        const step = mu / farEnergy;
        let farIdxW = (this.farWriteIdx - this.tapCount + s + this.farBuffer.length) % this.farBuffer.length;
        for (let t = 0; t < this.tapCount; t++) {
          const fIdx = (farIdxW + t) % this.farBuffer.length;
          this.weights[t] = this.weights[t] * this.leakage + step * errorSignal * this.farBuffer[fIdx];
        }
      }

      outputChannel[s] = errorSignal;
    }

    // ─── Update stats periodically ────────────────────────
    this.statsCounter += len;
    if (this.statsCounter >= this.sampleRate) {  /* every ~1 second */
      this.statsCounter = 0;
      if (sumErrorEnergy > 0 && sumNearEnergy > 0) {
        this.erle = 10 * Math.log10(sumNearEnergy / Math.max(sumErrorEnergy, 1e-10));
      }
      this.nearEnergy = sumNearEnergy / len;
      this.errorEnergy = sumErrorEnergy / len;

      this.port.postMessage({
        type: 'stats',
        erle: this.erle,
        nearEnergy: this.nearEnergy,
        errorEnergy: this.errorEnergy,
        doubleTalk: this.nearPeak > this.rho * this.farPeak ? 1 : 0,
        converged: currentFrame - this.startFrame > this.warmupFrames ? 1 : 0,
      });
    }

    return true;
  }
}

registerProcessor('echo-cancellation-processor', EchoCancellationProcessor);
