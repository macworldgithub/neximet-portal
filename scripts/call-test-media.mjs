import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// A looping native file camera avoids platform-specific animated fake-device
// failures while still exercising getUserMedia, tracks and actual RTP codecs.
const directory = fileURLToPath(new URL('../test-results/calls-media/', import.meta.url));
mkdirSync(directory, { recursive: true });
const camera = path.join(directory, 'camera.y4m');
const width = 640, height = 360;
const frames = [Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`)];
for (let index = 0; index < 20; index++) {
  const frame = Buffer.alloc(width * height * 3 / 2);
  frame.fill(80 + index * 3, 0, width * height);
  frame.fill(110, width * height, width * height * 5 / 4);
  frame.fill(170, width * height * 5 / 4);
  frames.push(Buffer.from('FRAME\n'), frame);
}
writeFileSync(camera, Buffer.concat(frames));
const microphone = path.join(directory, 'microphone.wav');
const sampleRate = 48000, sampleCount = sampleRate * 2;
const wave = Buffer.alloc(44 + sampleCount * 2);
wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(sampleRate, 24); wave.writeUInt32LE(sampleRate * 2, 28);
wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(sampleCount * 2, 40);
for (let index = 0; index < sampleCount; index++) wave.writeInt16LE(Math.round(7000 * Math.sin(2 * Math.PI * 440 * index / sampleRate)), 44 + index * 2);
writeFileSync(microphone, wave);

export const callBrowserOptions = { headless: true,
  args: ['--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${camera}`, `--use-file-for-fake-audio-capture=${microphone}`, '--use-fake-ui-for-media-stream'],
  ...(process.env.CALL_TEST_BROWSER ? { executablePath: process.env.CALL_TEST_BROWSER } : {}),
};
