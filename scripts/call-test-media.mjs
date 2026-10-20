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

export const callBrowserOptions = { headless: true,
  args: ['--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${camera}`, '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  ...(process.env.CALL_TEST_BROWSER ? { executablePath: process.env.CALL_TEST_BROWSER } : {}),
};
