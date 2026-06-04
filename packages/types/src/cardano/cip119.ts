import { z } from "zod"

/**
 * CIP-119: DRep Metadata Standard
 * https://github.com/cardano-foundation/CIPs/blob/master/CIP-0119/README.md
 */
export const Cip119BodySchema = z.object({
  givenName: z.string().min(1).max(80),
  image: z
    .object({
      "@type": z.string().optional(),
      contentUrl: z.string().url().optional(),
      sha256: z.string().optional(),
    })
    .optional(),
  motivations: z.string().optional(),
  objectives: z.string().optional(),
  qualifications: z.string().optional(),
  paymentAddress: z.string().optional(),
  doNotList: z.boolean().optional(),
  references: z
    .array(
      z.object({
        "@type": z.string(),
        label: z.string(),
        uri: z.string().url(),
      })
    )
    .optional(),
})

export const Cip119MetadataSchema = z.object({
  "@context": z.record(z.unknown()),
  hashAlgorithm: z.literal("blake2b-256"),
  body: Cip119BodySchema,
})

export type Cip119Body = z.infer<typeof Cip119BodySchema>
export type Cip119Metadata = z.infer<typeof Cip119MetadataSchema>

/** Build a minimal valid CIP-119 metadata object */
export function buildCip119Metadata(body: Cip119Body): Cip119Metadata {
  return {
    "@context": {
      "@language": "en",
      CIP100:
        "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#",
      CIP119:
        "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0119/README.md#",
      hashAlgorithm: "CIP100:hashAlgorithm",
      body: { "@id": "CIP119:body" },
      givenName: "CIP119:givenName",
      motivations: "CIP119:motivations",
      objectives: "CIP119:objectives",
      qualifications: "CIP119:qualifications",
      paymentAddress: "CIP119:paymentAddress",
      doNotList: "CIP119:doNotList",
      references: { "@id": "CIP119:references", "@container": "@set" },
    },
    hashAlgorithm: "blake2b-256",
    body,
  }
}
