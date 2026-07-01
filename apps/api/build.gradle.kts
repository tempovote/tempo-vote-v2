val ktorVersion = "3.2.0"
val exposedVersion = "0.57.0"
val cardanoClientVersion = "0.7.0-beta1"

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.ktor)
    alias(libs.plugins.kotlin.serialization)
}

group = "vote.tempo"
version = "0.1.0"

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
}

tasks.withType<JavaCompile>().configureEach {
    sourceCompatibility = "21"
    targetCompatibility = "21"
}

// Load .env from workspace root into the run task environment
fun loadDotEnv(): Map<String, String> {
    val envFile = rootDir.resolve(".env")
    if (!envFile.exists()) return emptyMap()
    return envFile.readLines()
        .filter { it.isNotBlank() && !it.startsWith("#") && "=" in it }
        .associate { line ->
            val idx = line.indexOf("=")
            val key = line.substring(0, idx).trim()
            val raw = line.substring(idx + 1).trim()
            val value = if ((raw.startsWith('"') && raw.endsWith('"')) ||
                            (raw.startsWith('\'') && raw.endsWith('\'')))
                raw.substring(1, raw.length - 1) else raw
            key to value
        }
}

application {
    mainClass.set("vote.tempo.ApplicationKt")
    applicationDefaultJvmArgs = listOf(
        "-Dio.ktor.development=${extra["development"] ?: "false"}",
        "--enable-native-access=ALL-UNNAMED",
    )
}

repositories {
    // Vendored patched cardano-client-transaction-spec (govActionDeposit support) so CI
    // can resolve it without a local ~/.m2 publish. Listed first; local dev still has
    // mavenLocal as a fallback. See gradle/local-maven/.
    maven { url = uri("$rootDir/gradle/local-maven") }
    mavenLocal()
    mavenCentral()
}

dependencies {
    // -------------------------------------------------------------------------
    // Cardano — transaction building + KupmiosBackendService
    // -------------------------------------------------------------------------
    implementation("com.bloxbean.cardano:cardano-client-lib:$cardanoClientVersion")
    implementation("com.bloxbean.cardano:cardano-client-backend-ogmios:$cardanoClientVersion")
    implementation("com.bloxbean.cardano:cardano-client-governance:$cardanoClientVersion")

    // -------------------------------------------------------------------------
    // Ktor server
    // -------------------------------------------------------------------------
    implementation("io.ktor:ktor-server-core:$ktorVersion")
    implementation("io.ktor:ktor-server-netty:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-server-cors:$ktorVersion")
    implementation("io.ktor:ktor-server-status-pages:$ktorVersion")
    implementation("io.ktor:ktor-server-call-logging:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")

    // Ktor client (for Kupo REST queries if needed outside KupmiosBackendService)
    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-cio:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-client-websockets:$ktorVersion")

    // -------------------------------------------------------------------------
    // Database — Exposed ORM + PostgreSQL + Flyway migrations
    // -------------------------------------------------------------------------
    implementation("org.jetbrains.exposed:exposed-core:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-dao:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-jdbc:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-kotlin-datetime:$exposedVersion")
    implementation("org.postgresql:postgresql:42.7.4")
    implementation("com.zaxxer:HikariCP:6.2.1")
    implementation("org.flywaydb:flyway-core:11.3.0")
    implementation("org.flywaydb:flyway-database-postgresql:11.3.0")

    // -------------------------------------------------------------------------
    // Auth — JWT
    // -------------------------------------------------------------------------
    implementation("io.ktor:ktor-server-auth:$ktorVersion")
    implementation("io.ktor:ktor-server-auth-jwt:$ktorVersion")
    implementation("com.auth0:java-jwt:4.4.0")

    // -------------------------------------------------------------------------
    // IPFS — Pinata (DRep metadata)
    // -------------------------------------------------------------------------
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // -------------------------------------------------------------------------
    // Crypto — blake2b-256 for CIP-119 anchor hash (transitive via cardano-client-lib, explicit for compile)
    // -------------------------------------------------------------------------
    implementation("org.bouncycastle:bcprov-jdk18on:1.78")

    // -------------------------------------------------------------------------
    // Cache — Caffeine (high-performance JVM cache, replaces manual ConcurrentHashMap+TTL)
    // -------------------------------------------------------------------------
    implementation("com.github.ben-manes.caffeine:caffeine:3.2.0")

    // -------------------------------------------------------------------------
    // Logging
    // -------------------------------------------------------------------------
    implementation("ch.qos.logback:logback-classic:1.5.16")
    implementation("io.github.oshai:kotlin-logging-jvm:7.0.3")

    // -------------------------------------------------------------------------
    // Test
    // -------------------------------------------------------------------------
    testImplementation("io.ktor:ktor-server-test-host:$ktorVersion")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testImplementation("org.testcontainers:postgresql:1.20.4")
    testImplementation("org.testcontainers:junit-jupiter:1.20.4")
}

tasks.test {
    useJUnitPlatform()
    // Ryuk (the Testcontainers reaper) is flaky in some sandboxes; the container is
    // explicitly stopped in @AfterAll so the suite doesn't depend on it.
    environment("TESTCONTAINERS_RYUK_DISABLED", "true")
    // docker-java otherwise falls back to API v1.32, which modern daemons reject
    // (minimum 1.40). It reads the *system property* api.version (not the env var),
    // so pin it here for the forked test JVM.
    systemProperty("api.version", "1.41")
}

tasks.named<JavaExec>("run") {
    environment(loadDotEnv())
}
