export class AudioPlayer {
  public audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private analyzer: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;

  async init() {
    if (!this.audioContext || this.audioContext.state === 'suspended') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, 
      });
      
      this.analyzer = this.audioContext.createAnalyser();
      this.analyzer.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
      this.analyzer.connect(this.audioContext.destination);

      await this.audioContext.resume();
      this.nextStartTime = this.audioContext.currentTime;
      console.log("🔊 Audio System Ready. State:", this.audioContext.state);
    }
  }

  // Use this for debugging!
  testTone() {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    osc.connect(this.audioContext.destination);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.2);
    console.log("🎵 Test beep played");
  }

  async playChunk(base64Data: string) {
    if (!this.audioContext || !this.analyzer || !this.dataArray) return;

    try {
      const sanitized = base64Data.replace(/-/g, '+').replace(/_/g, '/');
      const binaryString = window.atob(sanitized);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.analyzer);

      const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;

      // Visualizer
      this.analyzer.getByteFrequencyData(this.dataArray as any);
      const avg = this.dataArray.reduce((a, b) => a + b) / this.dataArray.length;
      if (avg > 0) console.log(`📊 Level: ${"█".repeat(Math.floor(avg / 10))}`);
      
    } catch (err) {
      console.error("Playback error:", err);
    }
  }
}
