import { z } from "zod"

export const MetadataReferenceSchema = z.object({
  type: z.string(),
  label: z.string(),
  uri: z.string().url(),
})

export const MetadataUploadRequestSchema = z.object({
  drepId: z.string().min(1),
  givenName: z.string().min(1).max(80),
  motivations: z.string().optional(),
  objectives: z.string().optional(),
  qualifications: z.string().optional(),
  imageUrl: z.string().url().optional(),
  paymentAddress: z.string().optional(),
  references: z.array(MetadataReferenceSchema).default([]),
})

export const MetadataUploadResponseSchema = z.object({
  anchorUrl: z.string(),
  anchorDataHash: z.string(),
})

export type MetadataReference = z.infer<typeof MetadataReferenceSchema>
export type MetadataUploadRequest = z.infer<typeof MetadataUploadRequestSchema>
export type MetadataUploadResponse = z.infer<typeof MetadataUploadResponseSchema>
