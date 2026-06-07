package vote.tempo.routes

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.time.Duration.Companion.minutes
import kotlinx.datetime.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder
import kotlinx.serialization.Serializable
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import vote.tempo.db.AuthSessions
import vote.tempo.plugins.JWT_AUDIENCE
import vote.tempo.plugins.JWT_ISSUER
import vote.tempo.plugins.JWT_SECRET
import java.io.ByteArrayOutputStream
import java.security.SecureRandom
import java.util.Date

private val secureRandom = SecureRandom()

@Serializable
data class AuthVerifyRequest(
    val stakeAddress: String,
    val network: String,
    val nonce: String,
    val signature: String,
    val key: String,
    val drepId: String? = null,
)

fun Route.authRoutes() {
    route("/auth") {

        // GET /auth/challenge?stakeAddress=stake1...&network=preprod
        // Returns a one-time nonce (expires in 10 min) to be signed by the wallet.
        get("/challenge") {
            val stakeAddress = call.request.queryParameters["stakeAddress"]
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "stakeAddress required"))
            val network = call.request.queryParameters["network"] ?: "preprod"

            val nonce = generateNonce()
            val now   = Clock.System.now().toLocalDateTime(TimeZone.UTC)
            val expires = Clock.System.now().plus(10.minutes).toLocalDateTime(TimeZone.UTC)

            // Pre-build delete condition — deleteWhere{} has a different lambda receiver than where{}
            val deleteExisting = with(SqlExpressionBuilder) {
                (AuthSessions.stakeAddress eq stakeAddress) and (AuthSessions.network eq network)
            }

            transaction {
                // Remove any existing nonce for this address (only one in-flight at a time)
                AuthSessions.deleteWhere { deleteExisting }
                AuthSessions.insert {
                    it[AuthSessions.stakeAddress] = stakeAddress
                    it[AuthSessions.network]      = network
                    it[AuthSessions.nonce]        = nonce
                    it[AuthSessions.createdAt]    = now
                    it[AuthSessions.expiresAt]    = expires
                }
            }

            call.respond(mapOf("nonce" to nonce))
        }

        // POST /auth/verify
        // Body: { stakeAddress, network, nonce, signature, key, drepId? }
        // Returns: { jwt }
        post("/verify") {
            val req = runCatching { call.receive<AuthVerifyRequest>() }.getOrElse {
                return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid request body"))
            }
            if (req.stakeAddress.isBlank() || req.nonce.isBlank() || req.signature.isBlank() || req.key.isBlank()) {
                return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing required fields"))
            }

            val now = Clock.System.now().toLocalDateTime(TimeZone.UTC)

            // Look up the nonce — must exist and not be expired
            val sessionId = transaction {
                AuthSessions.selectAll()
                    .where {
                        (AuthSessions.stakeAddress eq req.stakeAddress) and
                        (AuthSessions.network      eq req.network)      and
                        (AuthSessions.nonce        eq req.nonce)        and
                        (AuthSessions.expiresAt    greater now)
                    }
                    .singleOrNull()
                    ?.get(AuthSessions.id)
            } ?: return@post call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid or expired nonce"))

            // Verify CIP-30 COSE_Sign1 signature off the main thread
            val valid = withContext(Dispatchers.Default) {
                verifyCoseSign1(req.signature, req.key, req.nonce)
            }
            if (!valid) {
                return@post call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid signature"))
            }

            // Consume the nonce (one-time use)
            val deleteById = with(SqlExpressionBuilder) { AuthSessions.id eq sessionId }
            transaction { AuthSessions.deleteWhere { deleteById } }

            // Issue JWT — 24h expiry
            val token = JWT.create()
                .withIssuer(JWT_ISSUER)
                .withAudience(JWT_AUDIENCE)
                .withSubject(req.stakeAddress)
                .withClaim("network", req.network)
                .apply { if (req.drepId != null) withClaim("drepId", req.drepId) }
                .withExpiresAt(Date(System.currentTimeMillis() + 86_400_000L))
                .sign(Algorithm.HMAC256(JWT_SECRET))

            call.respond(mapOf("jwt" to token))
        }
    }
}

private fun generateNonce(): String {
    val bytes = ByteArray(32)
    secureRandom.nextBytes(bytes)
    return bytes.joinToString("") { "%02x".format(it) }
}

// ─── CIP-30 COSE_Sign1 verification ──────────────────────────────────────────
//
// CIP-30 signData returns:
//   signature = CBOR hex of COSE_Sign1 = [protected_bstr, {}, payload_bstr, sig_bstr]
//   key       = CBOR hex of COSE_Key   = {1:1, 3:-8, -1:6, -2:pubkey_bstr}
//
// Sig_Structure (what was actually signed by Ed25519):
//   ["Signature1", protected_bstr, b"", payload_bstr]  (CBOR-encoded)

private fun verifyCoseSign1(signatureHex: String, keyHex: String, nonce: String): Boolean = runCatching {
    val sigBytes = hexToBytes(signatureHex)
    val keyBytes = hexToBytes(keyHex)

    // Decode COSE_Sign1 array
    val coseSign1 = CborDecoder(sigBytes).readArray() ?: return false
    if (coseSign1.size != 4) return false

    val protectedBstr = coseSign1[0] as? ByteArray ?: return false
    val payloadBstr   = coseSign1[2] as? ByteArray ?: return false
    val signature     = coseSign1[3] as? ByteArray ?: return false

    // Payload must match the human-readable sign-in message the frontend constructs:
    //   "tempo.vote sign-in\nnonce: <hex-nonce>"
    // encoded as UTF-8. This is what the wallet displays to the user.
    val expectedPayload = "tempo.vote sign-in\nnonce: $nonce".toByteArray(Charsets.UTF_8)
    if (!payloadBstr.contentEquals(expectedPayload)) return false

    // Decode COSE_Key map, extract x-coordinate (-2 key = 32-byte Ed25519 public key)
    val coseKey    = CborDecoder(keyBytes).readMap() ?: return false
    val pubKeyBytes = (coseKey[-2L] ?: coseKey[-2]) as? ByteArray ?: return false

    // Build and verify Sig_Structure
    val sigStructure = encodeSigStructure(protectedBstr, payloadBstr)
    verifyEd25519(sigStructure, signature, pubKeyBytes)
}.getOrDefault(false)

private fun verifyEd25519(message: ByteArray, signature: ByteArray, pubKey: ByteArray): Boolean = runCatching {
    val params = Ed25519PublicKeyParameters(pubKey, 0)
    val signer = Ed25519Signer()
    signer.init(false, params)
    signer.update(message, 0, message.size)
    signer.verifySignature(signature)
}.getOrDefault(false)

private fun encodeSigStructure(protectedBstr: ByteArray, payload: ByteArray): ByteArray {
    val out = ByteArrayOutputStream()
    out.write(0x84)                          // array(4)
    out.write(0x6A)                          // text(10)
    out.write("Signature1".toByteArray(Charsets.UTF_8))
    writeBstr(out, protectedBstr)            // protected header bstr
    out.write(0x40)                          // bytes(0) — empty external_aad
    writeBstr(out, payload)                  // payload
    return out.toByteArray()
}

private fun writeBstr(out: ByteArrayOutputStream, data: ByteArray) {
    when {
        data.size < 24  -> out.write(0x40 or data.size)
        data.size < 256 -> { out.write(0x58); out.write(data.size) }
        else            -> { out.write(0x59); out.write(data.size ushr 8); out.write(data.size and 0xFF) }
    }
    out.write(data)
}

// Minimal CBOR decoder — handles the subset used by COSE_Sign1 and COSE_Key
private class CborDecoder(private val data: ByteArray) {
    private var pos = 0

    fun readArray(): List<Any?>? {
        val b = next()
        if (b shr 5 != 4) return null
        val len = readArg(b and 0x1F).toInt()
        return List(len) { readAny() }
    }

    fun readMap(): Map<Any, Any?>? {
        val b = next()
        if (b shr 5 != 5) return null
        val len = readArg(b and 0x1F).toInt()
        val map = mutableMapOf<Any, Any?>()
        repeat(len) { map[readAny()!!] = readAny() }
        return map
    }

    private fun readAny(): Any? {
        val b = next()
        val major = b shr 5
        val info  = b and 0x1F
        return when (major) {
            0 -> readArg(info)                              // uint → Long
            1 -> -(readArg(info) + 1L)                     // nint → Long
            2 -> readRaw(info)                              // bstr → ByteArray
            3 -> String(readRaw(info), Charsets.UTF_8)     // tstr → String
            4 -> { val n = readArg(info).toInt(); List(n) { readAny() } }
            5 -> {
                val n = readArg(info).toInt()
                val m = mutableMapOf<Any, Any?>()
                repeat(n) { m[readAny()!!] = readAny() }
                m
            }
            else -> null
        }
    }

    private fun next(): Int = data[pos++].toInt() and 0xFF

    private fun readArg(info: Int): Long = when {
        info < 24  -> info.toLong()
        info == 24 -> next().toLong()
        info == 25 -> { val v = (next() shl 8) or next(); v.toLong() }
        info == 26 -> {
            val v = (next().toLong() shl 24) or (next().toLong() shl 16) or (next().toLong() shl 8) or next().toLong()
            v
        }
        else -> throw IllegalStateException("Unsupported CBOR additional info: $info")
    }

    private fun readRaw(info: Int): ByteArray {
        val len = readArg(info).toInt()
        val bytes = data.copyOfRange(pos, pos + len)
        pos += len
        return bytes
    }
}

private fun hexToBytes(hex: String): ByteArray {
    val h = hex.lowercase().trimStart()
    require(h.length % 2 == 0) { "Hex string must have even length" }
    return ByteArray(h.length / 2) { i ->
        ((h[i * 2].digitToInt(16) shl 4) or h[i * 2 + 1].digitToInt(16)).toByte()
    }
}
