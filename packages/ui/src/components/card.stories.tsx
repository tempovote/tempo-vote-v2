import type { Meta, StoryObj } from "@storybook/react-vite"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"
import { Separator } from "./separator"
import { Button } from "./button"

const meta: Meta<typeof Card> = { title: "Primitives/Card", component: Card }
export default meta
type Story = StoryObj<typeof Card>

export const Variants: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4 md:grid-cols-3">
      <Card variant="default">
        <CardTitle>Default</CardTitle>
        <CardDescription>Hover: border ring + glow</CardDescription>
      </Card>
      <Card variant="static">
        <CardTitle>Static</CardTitle>
        <CardDescription>Không hover effect</CardDescription>
      </Card>
      <Card variant="accent">
        <CardTitle>Accent</CardTitle>
        <CardDescription>Border primary/30</CardDescription>
      </Card>
    </div>
  ),
}

export const WithSections: Story = {
  render: () => (
    <Card variant="static" className="max-w-md">
      <CardHeader>
        <CardTitle>Governance Action</CardTitle>
        <CardDescription>Đầy đủ header / content / footer</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="py-4 text-sm text-muted-foreground">
        Nội dung card với <span className="text-foreground">text-foreground</span> nhấn mạnh.
      </CardContent>
      <CardFooter>
        <Button size="sm">Vote</Button>
        <Button size="sm" variant="outline">Chi tiết</Button>
      </CardFooter>
    </Card>
  ),
}
