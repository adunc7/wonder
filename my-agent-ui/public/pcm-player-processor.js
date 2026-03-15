class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.port.onmessage = (e) => this.buffer.push(...e.data);
  }
  process(inputs, outputs) {
    const output = outputs[0][0];
    for (let i = 0; i < output.length; i++) {
      output[i] = this.buffer.shift() || 0;
    }
    return true;
  }
}
registerProcessor("pcm-player-processor", PCMPlayerProcessor);