import type { Meta, StoryObj } from "@storybook/react-vite"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

const meta: Meta<typeof Tabs> = { title: "Primitives/Tabs", component: Tabs }
export default meta
type Story = StoryObj<typeof Tabs>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="votes" className="max-w-lg">
      <TabsList>
        <TabsTrigger value="votes">Votes</TabsTrigger>
        <TabsTrigger value="metadata">Metadata</TabsTrigger>
        <TabsTrigger value="history" disabled>History</TabsTrigger>
      </TabsList>
      <TabsContent value="votes" className="text-sm text-muted-foreground">Nội dung tab Votes.</TabsContent>
      <TabsContent value="metadata" className="text-sm text-muted-foreground">Nội dung tab Metadata.</TabsContent>
    </Tabs>
  ),
}
