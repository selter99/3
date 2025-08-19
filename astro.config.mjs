import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://cicihere.com", // domain chính
  output: "static",             // build MPA tĩnh
  integrations: [
    tailwind({
      applyBaseStyles: true, // giữ base styles
    }),
  ],
});
