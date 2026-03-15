export class AudioRecorder {
  private ctx: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;

  constructor() {
    this.stop = this.stop.bind(this);
  }

  async start(onAudioData: (data: Int16Array) => void) {
    try {
      this.ctx = new AudioContext({ sampleRate: 16000 });
      await this.ctx.audioWorklet.addModule("/pcm-recorder-processor.js");

      if (this.ctx.state === "suspended") await this.ctx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.ctx.createMediaStreamSource(stream);
      
      this.worklet = new AudioWorkletNode(this.ctx, "pcm-recorder-processor");

      this.worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
        const float32 = e.data;
        const pcm16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        onAudioData(pcm16);
      };

      source.connect(this.worklet);
    } catch (err) {
      console.error("Link Failure:", err);
    }
  }

  stop() {
    console.log("Recorder stopping...");
    if (this.worklet) {
      this.worklet.disconnect();
      this.worklet = null;
    }
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close();
      this.ctx = null;
    }
  }
}