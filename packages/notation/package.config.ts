import { defineConfig } from "@sanity/pkg-utils";

export default defineConfig({
  tsconfig: "tsconfig.dist.json",
  dts: "rolldown",
  extract: {
    rules: {
      "ae-missing-release-tag": "off",
    },
  },
});
