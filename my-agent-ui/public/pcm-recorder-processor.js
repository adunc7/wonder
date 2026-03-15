class PCMRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input.length > 0 && input[0]) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor("pcm-recorder-processor", PCMRecorderProcessor);