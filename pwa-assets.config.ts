import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

const background = '#0E0C0A';
// The icon's own background fills the square, and its shape sits inside the maskable safe zone, so no padding.

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0, resizeOptions: { background } },
    apple: { ...preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
});
