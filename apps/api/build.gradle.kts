val ktorVersion = "3.1.0"
val exposedVersion = "0.57.0"
val cardanoClientVersion = "0.7.0-beta1"

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.ktor)
    alias(libs.plugins.kotlin.serialization)
}

group = "vote.tempo"
version = "0.1.0"

application {
    mainClass.set("vote.tempo.ApplicationKt")
    applicationDefaultJvmArgs = listOf("-Dio.ktor.development=${extra["development"] ?: "false"}")
}

repositories {
    mavenCentral()
}

dependencies {
    // -------------------------------------------------------------------------
    // Cardano — transaction building + KupmiosBackendService
    // -------------------------------------------------------------------------
    implementation("com.bloxbean.cardano:cardano-client-lib:$cardanoClientVersion")
    implementation("com.bloxbean.cardano:cardano-client-backend-ogmios:$cardanoClientVersion")

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
    // Logging
    // -------------------------------------------------------------------------
    implementation("ch.qos.logback:logback-classic:1.5.16")
    implementation("io.github.oshai:kotlin-logging-jvm:7.0.3")

    // -------------------------------------------------------------------------
    // Test
    // -------------------------------------------------------------------------
    testImplementation("io.ktor:ktor-server-test-host:$ktorVersion")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
}

tasks.test {
    useJUnitPlatform()
}
