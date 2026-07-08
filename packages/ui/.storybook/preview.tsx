import type { Decorator, Preview } from "@storybook/react-vite"
import { useEffect } from "react"
import "./preview.css"

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string) ?? "dark"
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])
  return (
    <div className="min-h-screen bg-background p-6 font-sans text-foreground antialiased">
      <Story />
    </div>
  )
}

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: ["dark", "light"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "dark" },
  parameters: {
    layout: "fullscreen",
    backgrounds: { disable: true },
  },
}

export default preview
