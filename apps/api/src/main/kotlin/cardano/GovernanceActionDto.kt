package vote.tempo.cardano

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

// PoolInfo is defined in KoiosClient.kt (same package)

@Serializable
data class VoteEntry(
    val role: String,         // "drep" | "cc" | "spo"
    val id: String,           // credential hex for DRep/CC; poolId (hex) for SPO
    val vote: String,         // "yes" | "no" | "abstain"
    val votingPower: Long = 0L,  // lovelace (DRep + SPO from Koios; 0 for CC)
    val anchorUrl: String? = null,    // DRep CIP-119 registration anchor — for name resolution
    val memberName: String? = null,   // CC member display name — resolved via hot→cold credential mapping
    val poolName: String? = null,     // SPO pool display name — resolved from Koios meta_json.name
)

@Serializable
data class GovernanceActionDto(
    val txHash: String,
    val index: Int,
    val type: String,           // display label, e.g. "Treasury Withdrawals"
    val actionType: String,     // raw Ogmios type, e.g. "treasuryWithdrawals"
    val anchorUrl: String?,     // ipfs:// or https:// — convert for display on FE
    val anchorHash: String?,
    val expiresEpoch: Int,
    val deposit: Long,          // lovelace
    val drepVotes: DRepVoteStats,
    val spoVotes: SPOVoteStats,
    val ccVotes: VoteCounts,
    val votes: List<VoteEntry> = emptyList(),  // individual votes for vote history display
    val details: JsonElement? = null,           // type-specific action body — see extractActionDetails()
    val status: String = "active",              // computed by computeGAStatus()
)

/**
 * DRep vote totals with ADA voting power — implements the GovTool ratification formula.
 *
 * Ratification check (denominator = totalActiveDRepStake, abstain excluded):
 *   Non-NoConfidence: yesTotal = yesVotingPower,           noTotal = noVotingPower + autoNoConfidenceStake
 *   NoConfidence:     yesTotal = yesVotingPower + autoNoConfidenceStake, noTotal = noVotingPower
 *
 * Ref: https://docs.gov.tools/cardano-govtool/faqs/how-governance-action-vote-totals-are-calculated-in-govtool
 */
@Serializable
data class DRepVoteStats(
    val yes: Int,
    val no: Int,
    val abstain: Int,
    /** Lovelace staked by DReps that voted yes (active DReps only, excludes predefined). */
    val yesVotingPower: Long,
    val noVotingPower: Long,
    val abstainVotingPower: Long,
    /** Stake delegated to the always-abstain predefined DRep. Added to abstain total, NOT in denominator. */
    val autoAbstainStake: Long,
    /** Stake delegated to the always-no-confidence predefined DRep. Counted as No (or Yes for NoConfidence). IS in denominator. */
    val autoNoConfidenceStake: Long,
    /** Denominator: sum of all active registered DRep stakes + autoNoConfidenceStake (excludes autoAbstain). */
    val totalActiveDRepStake: Long,
)

@Serializable
data class VoteCounts(
    val yes: Int,
    val no: Int,
    val abstain: Int,
    /**
     * For CC only: total active CC members (seat active + delegate authorized).
     * Used as denominator (N_Yes / N_Active). 0 = fall back to votes cast.
     */
    val activeMembers: Int = 0,
    /**
     * For CC only: on-chain quorum fraction (e.g. 0.6667 for 2/3).
     * Sourced from constitutionalCommittee.quorum Ogmios field.
     * 0 = not available; fall back to static UI threshold.
     */
    val quorum: Double = 0.0,
) {
    val total: Int get() = yes + no + abstain
}

/**
 * SPO vote totals with ADA voting power sourced from Koios `voting_power` field.
 *
 * Denominator = totalVotingPower (sum of voting_power for all SPOs that voted).
 * Unlike DRep, we have no "total registered SPO stake" — only votes cast contribute.
 */
@Serializable
data class SPOVoteStats(
    val yes: Int,
    val no: Int,
    val abstain: Int,
    /** Lovelace voting_power for SPOs that voted yes/no/abstain. */
    val yesVotingPower: Long = 0L,
    val noVotingPower: Long = 0L,
    val abstainVotingPower: Long = 0L,
    /** Sum of yesVotingPower + noVotingPower + abstainVotingPower — used as % denominator. */
    val totalVotingPower: Long = 0L,
) {
    val total: Int get() = yes + no + abstain
}

// Hardcoded CC cold-credential → member name. Keys are raw 28-byte hex (56 chars, no CIP-129 prefix).
// Cardanoscan shows cold creds with a 1-byte CIP-129 prefix (0x12 = key, 0x13 = script) — strip it to get the key here.
// Update manually when CC membership changes.
private val CC_COLD_NAMES: Map<String, String> = mapOf(
    "16feefc225e06f75a3c917f4aa50acffde7631ea0355721f2ac12542" to "Cardano Curia",
    "1980dbf1ad624b0cb5410359b5ab14d008561994a6c2b6c53fabec00" to "Tingvard",
    "84aebcfd3e00d0f87af918fc4b5e00135f407e379893df7e7d392c6a" to "Eastern Cardano Council",
    "9752e4306e5ae864441d21064f791174c8b626199b8e7a45f9e03b45" to "Ace Alliance",
    "9cc3f387623f45dae6a68b7096b0c2e403d8601a82dc40221ead41e2" to "Cardano Japan Council",
    "13493790d9b03483a1e1e684ea4faf1ee48a58f402574e7f2246f4d4" to "Philuplc",
    "dc0d6ef49590eb6880a50a00adde17596e6d76f7159572fa1ff85f2a" to "KtorZ",
)

/**
 * Parsed CC context from `queryLedgerState/constitutionalCommittee`.
 * Also carries a runtime hot-credential → member-name map built from CC_COLD_NAMES
 * so vote entries can be annotated with display names without an extra lookup.
 */
data class CCContext(val activeMembers: Int, val quorum: Double, val hotToName: Map<String, String> = emptyMap()) {
    companion object { val EMPTY = CCContext(0, 0.0) }
}

/**
 * Parsed stake context from `queryLedgerState/delegateRepresentatives`.
 * Built once per cache refresh and passed into proposal mapping.
 */
data class DRepStakeContext(
    /** credentialHex (56-char) → lovelace for all registered active DReps. */
    val stakeMap: Map<String, Long>,
    val autoAbstainStake: Long,
    val autoNoConfidenceStake: Long,
    /** = Σ(stakeMap.values) + autoNoConfidenceStake — the ratification denominator. */
    val totalActiveDRepStake: Long,
    /** credentialHex → CIP-119 anchor URL (for DRep name resolution). */
    val anchorMap: Map<String, String> = emptyMap(),
) {
    companion object {
        val EMPTY = DRepStakeContext(emptyMap(), 0L, 0L, 0L)
    }
}

/**
 * Parse DRep stake distribution from the `delegateRepresentatives` Ogmios response.
 * Handles both JsonArray (direct) and JsonObject wrapper shapes.
 */
fun parseDRepStakeContext(raw: JsonElement): DRepStakeContext {
    val entries: JsonArray = when (raw) {
        is JsonArray  -> raw
        is JsonObject -> raw["delegateRepresentatives"]?.jsonArray
            ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
            ?: return DRepStakeContext.EMPTY
        else -> return DRepStakeContext.EMPTY
    }

    val stakeMap  = mutableMapOf<String, Long>()
    val anchorMap = mutableMapOf<String, String>()
    var autoAbstainStake = 0L
    var autoNoConfidenceStake = 0L

    for (entry in entries) {
        val obj = entry.jsonObject
        val type  = obj["type"]?.jsonPrimitive?.contentOrNull ?: continue
        val stake = obj["stake"]?.jsonObject?.let { extractLovelace(it) } ?: 0L

        when (type) {
            "abstain"      -> autoAbstainStake = stake
            "noConfidence" -> autoNoConfidenceStake = stake
            "registered"   -> {
                val id = obj["id"]?.jsonPrimitive?.contentOrNull ?: continue
                stakeMap[id] = stake
                // CIP-119 anchor URL — may appear under "metadata" or "anchor"
                val url = (obj["metadata"] ?: obj["anchor"])?.jsonObject
                    ?.get("url")?.jsonPrimitive?.contentOrNull
                if (url != null) anchorMap[id] = url
            }
        }
    }

    val totalActiveDRepStake = stakeMap.values.sumOf { it } + autoNoConfidenceStake

    return DRepStakeContext(stakeMap, autoAbstainStake, autoNoConfidenceStake, totalActiveDRepStake, anchorMap)
}

/**
 * Parse CC context from `queryLedgerState/constitutionalCommittee` response.
 *
 * N_Active = members where seat status == "active" AND delegate status == "authorized".
 * A member whose delegate resigned cannot vote and must be excluded from the denominator.
 *
 * quorum = on-chain required fraction (e.g. "2/3" → 0.6667). Ogmios returns it as a
 * rational string ("p/q") or decimal string.
 */
fun parseCCContext(raw: JsonElement): CCContext {
    val obj = raw as? JsonObject ?: return CCContext.EMPTY
    val members = obj["members"]?.jsonArray ?: return CCContext.EMPTY

    var activeMembers = 0
    val hotToName = mutableMapOf<String, String>()

    for (entry in members) {
        val member = entry.jsonObject
        val seatActive     = member["status"]?.jsonPrimitive?.contentOrNull == "active"
        val delegateObj    = member["delegate"]?.jsonObject
        val delegateActive = delegateObj?.get("status")?.jsonPrimitive?.contentOrNull == "authorized"
        if (seatActive && delegateActive) activeMembers++

        // Map hot credential → name via the hardcoded cold credential table.
        // CC members vote using their HOT credential; Cardanoscan shows the COLD credential.
        val coldHex = extractCCCredentialHex(member["id"]) ?: continue
        val name    = CC_COLD_NAMES[coldHex] ?: continue
        val hotHex  = delegateObj?.let { extractCCCredentialHex(it["id"]) } ?: continue
        hotToName[hotHex] = name
    }

    val quorum = parseRationalString(obj["quorum"]?.jsonPrimitive?.contentOrNull ?: "")
    return CCContext(activeMembers, quorum, hotToName)
}

/**
 * Extract a raw 28-byte credential hex (56 chars) from a CC member id field.
 * Handles: plain 56-char hex, 58-char hex with 1-byte CIP-129 prefix (0x12/0x13 cold, 0x02/0x03 hot),
 * and nested {keyHash/scriptHash: hex} objects. Returns null on unrecognised format.
 */
private fun extractCCCredentialHex(elem: JsonElement?): String? {
    if (elem == null) return null
    return when {
        elem is JsonPrimitive -> {
            val s = elem.contentOrNull ?: return null
            when (s.length) {
                56 -> s
                58 -> s.substring(2)  // strip 1-byte CIP-129 prefix
                else -> null
            }
        }
        elem is JsonObject -> {
            val hex = elem["keyHash"]?.jsonPrimitive?.contentOrNull
                ?: elem["scriptHash"]?.jsonPrimitive?.contentOrNull
                ?: return null
            when (hex.length) { 56 -> hex; 58 -> hex.substring(2); else -> null }
        }
        else -> null
    }
}

/** Parse "p/q" or decimal string → Double. Returns 0.0 on failure. */
private fun parseRationalString(s: String): Double {
    if (s.isBlank()) return 0.0
    val slash = s.indexOf('/')
    return if (slash >= 0) {
        val num = s.substring(0, slash).trim().toDoubleOrNull() ?: return 0.0
        val den = s.substring(slash + 1).trim().toDoubleOrNull()?.takeIf { it != 0.0 } ?: return 0.0
        num / den
    } else {
        s.toDoubleOrNull() ?: 0.0
    }
}

/**
 * Extract and map all proposals from a raw Ogmios governanceProposals response.
 * Handles both bare JsonArray and wrapped JsonObject shapes from Ogmios.
 * Items that fail to parse are silently dropped via runCatching.
 */
fun parseProposals(
    raw: JsonElement,
    stakeCtx: DRepStakeContext = DRepStakeContext.EMPTY,
    ccCtx: CCContext = CCContext.EMPTY,
    thresholds: GovernanceThresholds = GovernanceThresholds.DEFAULT,
    currentEpoch: Int = 0,
    poolInfoMap: Map<String, PoolInfo> = emptyMap(),
): List<GovernanceActionDto> {
    val array: JsonArray = when (raw) {
        is JsonArray  -> raw
        is JsonObject -> raw["governanceProposals"]?.jsonArray
            ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
            ?: return emptyList()
        else          -> return emptyList()
    }
    return array.mapNotNull { item ->
        runCatching { mapOgmiosProposal(item.jsonObject, stakeCtx, ccCtx, thresholds, currentEpoch, poolInfoMap) }.getOrNull()
    }
}

/** Map one Ogmios `governanceProposals` item → GovernanceActionDto. Returns null on parse error. */
fun mapOgmiosProposal(
    obj: JsonObject,
    stakeCtx: DRepStakeContext = DRepStakeContext.EMPTY,
    ccCtx: CCContext = CCContext.EMPTY,
    thresholds: GovernanceThresholds = GovernanceThresholds.DEFAULT,
    currentEpoch: Int = 0,
    poolInfoMap: Map<String, PoolInfo> = emptyMap(),
): GovernanceActionDto? = runCatching {
    val proposal = obj["proposal"]?.jsonObject ?: return null
    val txHash = proposal["transaction"]?.jsonObject?.get("id")?.jsonPrimitive?.content ?: return null
    val index = proposal["index"]?.jsonPrimitive?.int ?: 0

    val action = obj["action"]?.jsonObject ?: return null
    val actionType = action["type"]?.jsonPrimitive?.contentOrNull ?: "unknown"
    val type = actionTypeLabel(actionType)

    val metadata = obj["metadata"]?.jsonObject
    val anchorUrl = metadata?.get("url")?.jsonPrimitive?.contentOrNull
    val anchorHash = metadata?.get("hash")?.jsonPrimitive?.contentOrNull

    val expiresEpoch = obj["until"]?.jsonObject?.get("epoch")?.jsonPrimitive?.int ?: 0

    val deposit = obj["deposit"]?.jsonObject
        ?.let { extractLovelace(it) } ?: 0L

    // votes is an array of { issuer: { role, from, id }, vote: "yes"|"no"|"abstain" }
    val votes = obj["votes"]?.jsonArray ?: JsonArray(emptyList())

    val drepVotes  = aggregateDRepVotes(votes, stakeCtx)
    val spoVotes   = aggregateSPOVotes(votes, poolInfoMap)
    val ccVotes    = aggregateVotes(votes, "constitutionalCommittee", ccCtx.activeMembers, ccCtx.quorum)
    val voteEntries = extractVoteEntries(votes, stakeCtx, ccCtx, poolInfoMap)

    val dtoDetails = extractActionDetails(actionType, action, proposal)
    val spoVoteCounts = VoteCounts(spoVotes.yes, spoVotes.no, spoVotes.abstain)
    val status = computeGAStatus(actionType, drepVotes, spoVoteCounts, ccVotes, expiresEpoch, currentEpoch, thresholds)

    GovernanceActionDto(
        txHash = txHash,
        index = index,
        type = type,
        actionType = actionType,
        anchorUrl = anchorUrl,
        anchorHash = anchorHash,
        expiresEpoch = expiresEpoch,
        deposit = deposit,
        drepVotes = drepVotes,
        spoVotes = spoVotes,
        ccVotes = ccVotes,
        votes = voteEntries,
        details = dtoDetails,
        status = status,
    )
}.getOrNull()

/**
 * Extract type-specific fields from the Ogmios action body.
 * Returns null for types with no extra data (infoAction, noConfidence).
 */
private fun extractActionDetails(actionType: String, action: JsonObject, proposal: JsonObject): JsonElement? {
    return when (actionType) {

        "hardForkInitiation" -> buildJsonObject {
            action["version"]?.jsonObject?.let { v ->
                v["major"]?.jsonPrimitive?.intOrNull?.let { put("versionMajor", it) }
                v["minor"]?.jsonPrimitive?.intOrNull?.let { put("versionMinor", it) }
            }
            addPrevActionId(this, action)
        }

        "newConstitution" -> buildJsonObject {
            action["constitution"]?.jsonObject?.let { c ->
                c["anchor"]?.jsonObject?.let { a ->
                    a["url"]?.jsonPrimitive?.contentOrNull?.let  { put("constitutionUrl", it) }
                    a["hash"]?.jsonPrimitive?.contentOrNull?.let { put("constitutionHash", it) }
                }
                c["script"]?.jsonPrimitive?.contentOrNull?.let { put("guardrailsHash", it) }
            }
            addPrevActionId(this, action)
        }

        "treasuryWithdrawals" -> buildJsonObject {
            // Ogmios: withdrawals is a JsonObject { stakeAddress → { ada: { lovelace: N } } }
            val withdrawalsObj = action["withdrawals"]?.jsonObject ?: JsonObject(emptyMap())
            put("withdrawals", buildJsonArray {
                for ((stakeAddress, valueEl) in withdrawalsObj) {
                    val lovelace = runCatching {
                        val v = valueEl.jsonObject
                        v["ada"]?.jsonObject?.get("lovelace")?.jsonPrimitive?.longOrNull
                            ?: v["lovelace"]?.jsonPrimitive?.longOrNull
                            ?: 0L
                    }.getOrDefault(0L)
                    add(buildJsonObject {
                        put("stakeCredential", stakeAddress)
                        put("lovelace", lovelace)
                    })
                }
            })
            action["guardrails"]?.jsonObject?.get("hash")?.jsonPrimitive?.contentOrNull
                ?.let { put("guardrailsHash", it) }
            addPrevActionId(this, action)
        }

        "updateCommittee" -> buildJsonObject {
            // Quorum threshold
            action["quorum"]?.let { q ->
                when {
                    q is JsonObject -> {
                        val n = q["numerator"]?.jsonPrimitive?.intOrNull
                        val d = q["denominator"]?.jsonPrimitive?.intOrNull
                        if (n != null && d != null) {
                            put("quorumNumerator", n)
                            put("quorumDenominator", d)
                        }
                    }
                    q is JsonPrimitive -> q.doubleOrNull?.let { put("quorumRate", it) }
                    else -> {}
                }
            }
            // Added members: [{credential: {hash}, bound: {epoch}}]
            val added = action["members"]?.jsonObject?.get("added")?.jsonArray
                ?: action["members"]?.jsonArray  // some versions use flat array
                ?: JsonArray(emptyList())
            put("addedMembers", buildJsonArray {
                for (m in added) {
                    val mObj = m.jsonObject
                    val cred = mObj["credential"]?.jsonObject?.get("hash")?.jsonPrimitive?.contentOrNull
                        ?: mObj["id"]?.jsonPrimitive?.contentOrNull
                    val epoch = mObj["bound"]?.jsonObject?.get("epoch")?.jsonPrimitive?.intOrNull
                        ?: mObj["epoch"]?.jsonPrimitive?.intOrNull
                    if (cred != null) {
                        add(buildJsonObject {
                            put("credential", cred)
                            if (epoch != null) put("termEpoch", epoch)
                        })
                    }
                }
            })
            // Removed members: list of credential hashes
            val removed = action["members"]?.jsonObject?.get("removed")?.jsonArray
                ?: JsonArray(emptyList())
            put("removedMembers", buildJsonArray {
                for (r in removed) {
                    val rObj = r.jsonObject
                    val cred = rObj["credential"]?.jsonObject?.get("hash")?.jsonPrimitive?.contentOrNull
                        ?: rObj["id"]?.jsonPrimitive?.contentOrNull
                    if (cred != null) add(JsonPrimitive(cred))
                }
            })
            addPrevActionId(this, action)
        }

        "protocolParametersUpdate" -> buildJsonObject {
            // Pass through the full parameters object — FE maps keys to labels
            action["parameters"]?.let { put("parameters", it) }
            action["guardrails"]?.let { g ->
                val hash = when {
                    g is JsonPrimitive -> g.contentOrNull
                    g is JsonObject    -> g["hash"]?.jsonPrimitive?.contentOrNull
                    else -> null
                }
                if (hash != null) put("guardrailsHash", hash)
            }
            addPrevActionId(this, action)
        }

        else -> null  // infoAction, noConfidence — no extra data
    }
}

/** Append previousActionId fields (txHash + index) if present in the action body. */
private fun addPrevActionId(builder: JsonObjectBuilder, action: JsonObject) {
    val prev = action["previousAction"]?.jsonObject
        ?: action["ancestor"]?.jsonObject
        ?: return
    val prevTx = prev["transaction"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull
    val prevIdx = prev["index"]?.jsonPrimitive?.intOrNull
    if (prevTx != null) {
        builder.put("prevActionTxHash", prevTx)
        if (prevIdx != null) builder.put("prevActionIndex", prevIdx)
    }
}

private fun extractVoteEntries(
    votes: JsonArray,
    stakeCtx: DRepStakeContext,
    ccCtx: CCContext = CCContext.EMPTY,
    poolInfoMap: Map<String, PoolInfo> = emptyMap(),
): List<VoteEntry> =
    votes.mapNotNull { entry ->
        val obj  = entry.jsonObject
        val role = obj["issuer"]?.jsonObject?.get("role")?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
        val id   = obj["issuer"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
        val vote = obj["vote"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
        val shortRole = when (role) {
            "delegateRepresentative" -> "drep"
            "constitutionalCommittee" -> "cc"
            "stakePoolOperator"       -> "spo"
            else -> return@mapNotNull null
        }
        val power      = when (shortRole) {
            "drep" -> stakeCtx.stakeMap[id] ?: 0L
            "spo"  -> poolInfoMap[id]?.votingPower ?: 0L
            else   -> 0L
        }
        val anchorUrl  = if (shortRole == "drep") stakeCtx.anchorMap[id] else null
        val memberName = if (shortRole == "cc") {
            val hex = when (id.length) { 58 -> id.substring(2); else -> id }
            ccCtx.hotToName[hex] ?: ccCtx.hotToName[id]
        } else null
        val poolName   = if (shortRole == "spo") poolInfoMap[id]?.name else null
        VoteEntry(role = shortRole, id = id, vote = vote, votingPower = power, anchorUrl = anchorUrl, memberName = memberName, poolName = poolName)
    }

private fun aggregateDRepVotes(votes: JsonArray, stakeCtx: DRepStakeContext): DRepVoteStats {
    var yes = 0; var no = 0; var abstain = 0
    var yesPower = 0L; var noPower = 0L; var abstainPower = 0L

    for (entry in votes) {
        val obj  = entry.jsonObject
        val role = obj["issuer"]?.jsonObject?.get("role")?.jsonPrimitive?.contentOrNull
        if (role != "delegateRepresentative") continue
        val id    = obj["issuer"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull ?: continue
        val stake = stakeCtx.stakeMap[id] ?: 0L

        when (obj["vote"]?.jsonPrimitive?.contentOrNull) {
            "yes"     -> { yes++;     yesPower    += stake }
            "no"      -> { no++;      noPower     += stake }
            "abstain" -> { abstain++; abstainPower += stake }
        }
    }

    return DRepVoteStats(
        yes = yes,
        no = no,
        abstain = abstain,
        yesVotingPower = yesPower,
        noVotingPower = noPower,
        abstainVotingPower = abstainPower,
        autoAbstainStake = stakeCtx.autoAbstainStake,
        autoNoConfidenceStake = stakeCtx.autoNoConfidenceStake,
        totalActiveDRepStake = stakeCtx.totalActiveDRepStake,
    )
}

private fun aggregateVotes(votes: JsonArray, role: String, activeMemberCount: Int = 0, quorum: Double = 0.0): VoteCounts {
    var yes = 0; var no = 0; var abstain = 0
    for (entry in votes) {
        val obj = entry.jsonObject
        val issuerRole = obj["issuer"]?.jsonObject?.get("role")?.jsonPrimitive?.contentOrNull
        if (issuerRole != role) continue
        when (obj["vote"]?.jsonPrimitive?.contentOrNull) {
            "yes"     -> yes++
            "no"      -> no++
            "abstain" -> abstain++
        }
    }
    return VoteCounts(yes, no, abstain, activeMembers = activeMemberCount, quorum = quorum)
}

private fun aggregateSPOVotes(votes: JsonArray, poolInfoMap: Map<String, PoolInfo>): SPOVoteStats {
    var yes = 0; var no = 0; var abstain = 0
    var yesPower = 0L; var noPower = 0L; var abstainPower = 0L
    for (entry in votes) {
        val obj  = entry.jsonObject
        val role = obj["issuer"]?.jsonObject?.get("role")?.jsonPrimitive?.contentOrNull
        if (role != "stakePoolOperator") continue
        val id    = obj["issuer"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull ?: continue
        val power = poolInfoMap[id]?.votingPower ?: 0L
        when (obj["vote"]?.jsonPrimitive?.contentOrNull) {
            "yes"     -> { yes++;     yesPower    += power }
            "no"      -> { no++;      noPower     += power }
            "abstain" -> { abstain++; abstainPower += power }
        }
    }
    val total = yesPower + noPower + abstainPower
    return SPOVoteStats(yes, no, abstain, yesPower, noPower, abstainPower, total)
}

/** Extract lovelace amount — handles { "ada": { "lovelace": N } } and { "lovelace": N } */
fun extractLovelace(value: JsonObject): Long {
    return value["ada"]?.jsonObject?.get("lovelace")?.jsonPrimitive?.long
        ?: value["lovelace"]?.jsonPrimitive?.long
        ?: 0L
}

internal fun actionTypeLabel(ogmiosType: String): String = when (ogmiosType) {
    "treasuryWithdrawals"      -> "Treasury Withdrawals"
    "protocolParametersUpdate" -> "Protocol Parameter Change"
    "hardForkInitiation"       -> "Hard Fork Initiation"
    "noConfidence"             -> "No Confidence"
    "updateCommittee"          -> "Update Committee"
    "newConstitution"          -> "New Constitution"
    "infoAction"               -> "Info Action"
    else                       -> ogmiosType
}
