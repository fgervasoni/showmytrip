// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
    integrations: [],
    output: 'server',
    adapter: netlify(),
});