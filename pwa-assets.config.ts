import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

const background = '#0A0A0A';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background } },
    apple: { ...preset.apple, padding: 0.1, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
});
