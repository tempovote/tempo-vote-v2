import { z } from "zod"

export const DappProtocolSchema = z.object({
  rank: z.number().int(),
  name: z.string(),
  slug: z.string(),
  logo: z.string(),
  category: z.string(),
  tvl: z.number(),
  change1d: z.number(),
  change7d: z.number(),
  volume24h: z.number().nullable(),
  fees24h: z.number().nullable(),
  revenue24h: z.number().nullable(),
  url: z.string(),
})
export type DappProtocol = z.infer<typeof DappProtocolSchema>

export const TvlPointSchema = z.object({
  label: z.string(),
  tvl: z.number(),
})
export type TvlPoint = z.infer<typeof TvlPointSchema>

export const DappRankingSchema = z.object({
  protocols: z.array(DappProtocolSchema),
  tvlHistory: z.array(TvlPointSchema),
  totalTvl: z.number(),
  change24h: z.number(),
  adaPrice: z.number(),
  updatedAt: z.string(), // ISO timestamp of the snapshot
})
export type DappRanking = z.infer<typeof DappRankingSchema>
