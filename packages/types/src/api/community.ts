import { z } from "zod"

export const CommunitySchema = z.object({
  id: z.string().uuid(),
  drepId: z.string(),
  network: z.string(),
  isActive: z.boolean(),
  activatedAt: z.string().nullable(),
})
export type Community = z.infer<typeof CommunitySchema>

export const PollStatusSchema = z.enum(["pending", "active", "closed"])
export type PollStatus = z.infer<typeof PollStatusSchema>

export const InternalPollSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  title: z.string(),
  abstract: z.string().nullable(),
  status: PollStatusSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  createdAt: z.string(),
  commentCount: z.number(),
})
export type InternalPoll = z.infer<typeof InternalPollSchema>

export const PollOptionWithCountSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  order: z.number(),
  voteCount: z.number(),
})
export type PollOptionWithCount = z.infer<typeof PollOptionWithCountSchema>

export const PollDetailSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  title: z.string(),
  abstract: z.string().nullable(),
  votingType: z.enum(["BASIC", "SINGLE_CHOICE", "MULTIPLE_CHOICE"]),
  status: PollStatusSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  createdAt: z.string(),
  options: z.array(PollOptionWithCountSchema),
  totalVotes: z.number(),
  userVote: z.string().uuid().nullable(),
})
export type PollDetail = z.infer<typeof PollDetailSchema>

export const PollCommentSchema = z.object({
  id: z.string().uuid(),
  stakeAddress: z.string(),
  content: z.string(),
  createdAt: z.string(),
})
export type PollComment = z.infer<typeof PollCommentSchema>

export const PollsPageSchema = z.object({
  items: z.array(InternalPollSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})
export type PollsPage = z.infer<typeof PollsPageSchema>

export const CommentsPageSchema = z.object({
  items: z.array(PollCommentSchema),
  total: z.number(),
})
export type CommentsPage = z.infer<typeof CommentsPageSchema>

export const CreatePollRequestSchema = z.object({
  network: z.string(),
  title: z.string().min(1).max(255),
  abstract: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
})
export type CreatePollRequest = z.infer<typeof CreatePollRequestSchema>

export const AddCommentRequestSchema = z.object({
  stakeAddress: z.string(),
  content: z.string().min(1),
})
export type AddCommentRequest = z.infer<typeof AddCommentRequestSchema>

export const CastVoteRequestSchema = z.object({
  optionId: z.string().uuid(),
  stakeAddress: z.string(),
})
export type CastVoteRequest = z.infer<typeof CastVoteRequestSchema>
