import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  async viteFinal(cfg) {
    const { mergeConfig } = await import("vite")
    return mergeConfig(cfg, { plugins: [tailwindcss()] })
  },
}

export default config
