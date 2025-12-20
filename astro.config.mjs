// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",          // ⭐⭐⭐ 关键：开启 Server 模式
  adapter: cloudflare(),     // ⭐ Cloudflare Pages / Workers
  integrations: [mdx()],     //
});
