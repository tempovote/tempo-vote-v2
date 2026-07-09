import { describe, it, expect } from "vitest"
import { buttonVariants } from "./button"

describe("buttonVariants", () => {
  it("default variant có gradient primary", () => {
    const cls = buttonVariants({})
    expect(cls).toContain("from-primary")
    expect(cls).toContain("to-accent-purple")
  })
  it("destructive variant dùng token destructive", () => {
    const cls = buttonVariants({ variant: "destructive" })
    expect(cls).toContain("bg-destructive")
    expect(cls).toContain("hover:bg-destructive-dark")
  })
  it("size icon là hình vuông", () => {
    expect(buttonVariants({ size: "icon" })).toContain("size-10")
  })
})
