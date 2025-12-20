// astro.config.mjs
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",          // ✅ 关键：API 才能 POST
  adapter: cloudflare(),     // ✅ 关键：Cloudflare Pages Functions
  integrations: [mdx()],
});
