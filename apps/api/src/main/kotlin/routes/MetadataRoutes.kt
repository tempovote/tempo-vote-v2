package vote.tempo.routes

import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.bouncycastle.crypto.digests.Blake2bDigest
import java.util.concurrent.TimeUnit

private val json = Json { prettyPrint = false }
private val okHttp = OkHttpClient.Builder()
    .connectTimeout(10, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .build()

@Serializable
data class ImageUploadRequest(
    val base64: String,
    val mimeType: String = "image/jpeg",
    val filename: String = "avatar",
)

@Serializable
data class MetadataUploadRequest(
    val drepId: String,
    val givenName: String,
    val motivations: String? = null,
    val objectives: String? = null,
    val qualifications: String? = null,
    val imageUrl: String? = null,
    val paymentAddress: String? = null,
    val doNotList: Boolean = false,
    val references: List<MetadataReference> = emptyList(),
)

@Serializable
data class MetadataReference(
    val type: String,
    val label: String,
    val uri: String,
)

@Serializable
data class VoteRationaleRequest(
    val drepId: String,
    val govActionTxHash: String,
    val govActionIndex: Int,
    val voteKind: String,  // YES | NO | ABSTAIN
    val comment: String,
)

fun Route.metadataRoutes() {
    route("/metadata") {
        authenticate("jwt") {
        // POST /metadata/upload-image  [requires JWT]
        post("/upload-image") {
            val pinataJwt = System.getenv("PINATA_JWT")
                ?: return@post call.respond(
                    HttpStatusCode.InternalServerError,
                    mapOf("error" to "PINATA_JWT not configured")
                )

            val req = try {
                call.receive<ImageUploadRequest>()
            } catch (e: Exception) {
                return@post call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "Invalid request: ${e.message}")
                )
            }

            val imageBytes = try {
                java.util.Base64.getDecoder().decode(req.base64)
            } catch (e: Exception) {
                return@post call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "Invalid base64 data")
                )
            }

            val ipfsHash = try {
                uploadImageToPinata(pinataJwt, imageBytes, req.filename, req.mimeType)
            } catch (e: Exception) {
                return@post call.respond(
                    HttpStatusCode.BadGateway,
                    mapOf("error" to "Pinata upload failed: ${e.message}")
                )
            }

            call.respond(mapOf("imageUrl" to "ipfs://$ipfsHash"))
        }

        // DELETE /metadata/unpin/{hash}  [requires JWT]
        delete("/unpin/{hash}") {
            val hash = call.parameters["hash"]
                ?: return@delete call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing hash"))
            val pinataJwt = System.getenv("PINATA_JWT")
                ?: return@delete call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "PINATA_JWT not configured"))
            try {
                unpinFromPinata(pinataJwt, hash)
                call.respond(mapOf("ok" to true))
            } catch (e: Exception) {
                call.respond(HttpStatusCode.BadGateway, mapOf("error" to "Unpin failed: ${e.message}"))
            }
        }

        // POST /metadata/upload  [requires JWT]
        post("/upload") {
            val pinataJwt = System.getenv("PINATA_JWT")
                ?: return@post call.respond(
                    HttpStatusCode.InternalServerError,
                    mapOf("error" to "PINATA_JWT not configured")
                )

            val req = try {
                call.receive<MetadataUploadRequest>()
            } catch (e: Exception) {
                return@post call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "Invalid request body: ${e.message}")
                )
            }

            if (req.givenName.isBlank()) {
                return@post call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "givenName is required")
                )
            }

            val metadata = buildCip119Metadata(req)
            val metadataJsonString = json.encodeToString(metadata)

            val anchorDataHash = blake2b256Hex(metadataJsonString.toByteArray(Charsets.UTF_8))

            val ipfsHash = try {
                uploadToPinata(pinataJwt, req.drepId, metadata)
            } catch (e: Exception) {
                return@post call.respond(
                    HttpStatusCode.BadGateway,
                    mapOf("error" to "Pinata upload failed: ${e.message}")
                )
            }

            call.respond(
                mapOf(
                    "anchorUrl" to "ipfs://$ipfsHash",
                    "anchorDataHash" to anchorDataHash,
                )
            )
        }
        // POST /metadata/vote-rationale  [requires JWT]
        post("/vote-rationale") {
            val pinataJwt = System.getenv("PINATA_JWT")
                ?: return@post call.respond(
                    HttpStatusCode.InternalServerError,
                    mapOf("error" to "PINATA_JWT not configured")
                )

            val req = try {
                call.receive<VoteRationaleRequest>()
            } catch (e: Exception) {
                return@post call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "Invalid request body: ${e.message}")
                )
            }

            if (req.comment.isBlank()) {
                return@post call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "comment is required")
                )
            }

            val metadata = buildCip100VoteRationale(req)
            val metadataBytes = json.encodeToString(metadata).toByteArray(Charsets.UTF_8)
            val anchorDataHash = blake2b256Hex(metadataBytes)

            val ipfsHash = try {
                val pinataName = "vote-rationale-${req.drepId.take(16)}-${req.govActionTxHash.take(8)}"
                uploadJsonToPinata(pinataJwt, metadata, pinataName)
            } catch (e: Exception) {
                return@post call.respond(
                    HttpStatusCode.BadGateway,
                    mapOf("error" to "Pinata upload failed: ${e.message}")
                )
            }

            call.respond(mapOf(
                "anchorUrl" to "ipfs://$ipfsHash",
                "anchorDataHash" to anchorDataHash,
            ))
        }

        } // authenticate("jwt")
    }
}

private fun buildCip119Metadata(req: MetadataUploadRequest): JsonObject = buildJsonObject {
    putJsonObject("@context") {
        put("@language", "en")
        put("CIP100", "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#")
        put("CIP119", "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0119/README.md#")
        put("hashAlgorithm", "CIP100:hashAlgorithm")
        putJsonObject("body") {
            put("@id", "CIP119:body")
        }
        put("givenName", "CIP119:givenName")
        put("motivations", "CIP119:motivations")
        put("objectives", "CIP119:objectives")
        put("qualifications", "CIP119:qualifications")
        put("paymentAddress", "CIP119:paymentAddress")
        put("doNotList", "CIP119:doNotList")
        putJsonObject("references") {
            put("@id", "CIP119:references")
            put("@container", "@set")
        }
        put("image", "CIP119:image")
    }
    put("hashAlgorithm", "blake2b-256")
    putJsonObject("body") {
        put("givenName", req.givenName)
        if (req.motivations != null) put("motivations", req.motivations)
        if (req.objectives != null) put("objectives", req.objectives)
        if (req.qualifications != null) put("qualifications", req.qualifications)
        if (req.paymentAddress != null) put("paymentAddress", req.paymentAddress)
        put("doNotList", req.doNotList)
        if (req.imageUrl != null) {
            putJsonObject("image") {
                put("@type", "ImageObject")
                put("contentUrl", req.imageUrl)
            }
        }
        if (req.references.isNotEmpty()) {
            putJsonArray("references") {
                req.references.forEach { ref ->
                    addJsonObject {
                        put("@type", ref.type)
                        put("label", ref.label)
                        put("uri", ref.uri)
                    }
                }
            }
        }
    }
}

private fun blake2b256Hex(input: ByteArray): String {
    val digest = Blake2bDigest(256)
    digest.update(input, 0, input.size)
    val out = ByteArray(32)
    digest.doFinal(out, 0)
    return out.joinToString("") { "%02x".format(it) }
}

private fun uploadImageToPinata(jwt: String, bytes: ByteArray, filename: String, mimeType: String): String {
    val mediaType = mimeType.toMediaType()
    val body = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart("file", filename, bytes.toRequestBody(mediaType))
        .addFormDataPart(
            "pinataMetadata",
            null,
            buildJsonObject { put("name", "drep-image-$filename") }.toString()
                .toRequestBody("application/json".toMediaType()),
        )
        .build()

    val request = Request.Builder()
        .url("https://api.pinata.cloud/pinning/pinFileToIPFS")
        .header("Authorization", "Bearer $jwt")
        .post(body)
        .build()

    val response = okHttp.newCall(request).execute()
    val responseBody = response.body?.string() ?: throw Exception("Empty response from Pinata")
    if (!response.isSuccessful) throw Exception("HTTP ${response.code}: $responseBody")
    return Json.parseToJsonElement(responseBody).jsonObject["IpfsHash"]?.jsonPrimitive?.content
        ?: throw Exception("IpfsHash missing from Pinata response")
}

private fun unpinFromPinata(jwt: String, ipfsHash: String) {
    val request = Request.Builder()
        .url("https://api.pinata.cloud/pinning/unpin/$ipfsHash")
        .header("Authorization", "Bearer $jwt")
        .delete()
        .build()
    val response = okHttp.newCall(request).execute()
    // 404 means already unpinned — treat as success
    if (!response.isSuccessful && response.code != 404) {
        throw Exception("HTTP ${response.code}: ${response.body?.string()}")
    }
}

private fun buildCip100VoteRationale(req: VoteRationaleRequest): JsonObject = buildJsonObject {
    putJsonObject("@context") {
        put("CIP100", "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#")
        put("hashAlgorithm", "CIP100:hashAlgorithm")
        putJsonObject("body") {
            put("@id", "CIP100:body")
            putJsonObject("@context") {
                put("comment", "CIP100:comment")
            }
        }
        putJsonObject("authors") {
            put("@id", "CIP100:authors")
            put("@container", "@set")
        }
    }
    put("hashAlgorithm", "blake2b-256")
    putJsonObject("body") {
        put("comment", req.comment)
    }
    putJsonArray("authors") {}
}

private fun uploadJsonToPinata(jwt: String, metadata: JsonObject, name: String): String {
    val body = buildJsonObject {
        put("pinataContent", metadata)
        putJsonObject("pinataMetadata") {
            put("name", name)
        }
    }.toString().toRequestBody("application/json".toMediaType())

    val request = Request.Builder()
        .url("https://api.pinata.cloud/pinning/pinJSONToIPFS")
        .header("Authorization", "Bearer $jwt")
        .post(body)
        .build()

    val response = okHttp.newCall(request).execute()
    val responseBody = response.body?.string()
        ?: throw Exception("Empty response from Pinata")

    if (!response.isSuccessful) throw Exception("HTTP ${response.code}: $responseBody")

    return Json.parseToJsonElement(responseBody).jsonObject["IpfsHash"]?.jsonPrimitive?.content
        ?: throw Exception("IpfsHash missing from Pinata response")
}

private fun uploadToPinata(jwt: String, drepId: String, metadata: JsonObject): String =
    uploadJsonToPinata(jwt, metadata, "drep-$drepId-metadata")
