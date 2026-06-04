import { z } from "zod"

export const VotingTypeSchema = z.enum(["BASIC", "SINGLE_CHOICE", "MULTIPLE_CHOICE"])
export type VotingType = z.infer<typeof VotingTypeSchema>

export const CreatePollSchema = z.object({
  communityId: z.string().uuid(),
  title: z.string().min(1).max(255),
  abstract: z.string().optional(),
  votingType: VotingTypeSchema,
  options: z.array(z.string()).optional(), // required for SINGLE_CHOICE / MULTIPLE_CHOICE
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
})
export type CreatePoll = z.infer<typeof CreatePollSchema>

export const PollOptionSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  order: z.number(),
})

export const PollSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  title: z.string(),
  abstract: z.string().nullable(),
  votingType: VotingTypeSchema,
  options: z.array(PollOptionSchema),
  startEpoch: z.number(),
  startsAt: z.string(),
  endsAt: z.string(),
  createdAt: z.string(),
})
export type Poll = z.infer<typeof PollSchema>

export const VoteOnPollSchema = z.object({
  optionId: z.string().uuid(),
  stakeAddress: z.string(),
})
export type VoteOnPoll = z.infer<typeof VoteOnPollSchema>
