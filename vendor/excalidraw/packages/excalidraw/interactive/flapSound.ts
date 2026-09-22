// A short, filtered noise burst makes a dry mechanical clack without an asset
// download. Created/resumed only from the user's draw gesture.
export function createFlapSound() {
  const context = new AudioContext();
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * 0.028),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] =
      (Math.random() * 2 - 1) * Math.exp(-i / (context.sampleRate * 0.005));
  }
  void context.resume().catch(() => {});
  return {
    click(count: number) {
      if (context.state !== "running") return;
      for (let i = 0; i < Math.min(3, Math.max(1, count)); i++) {
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        source.buffer = buffer;
        source.playbackRate.value = 0.85 + Math.random() * 0.3;
        filter.type = "bandpass";
        filter.frequency.value = 1500;
        filter.Q.value = 0.6;
        gain.gain.value = 0.16;
        source.connect(filter).connect(gain).connect(context.destination);
        source.onended = () => {
          source.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
        source.start(context.currentTime + i * 0.009);
      }
    },
    close() {
      void context.close().catch(() => {});
    },
  };
}
