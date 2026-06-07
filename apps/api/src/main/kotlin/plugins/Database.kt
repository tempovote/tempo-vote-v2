package vote.tempo.plugins

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.application.*
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.sql.Database

fun Application.configureDatabase() {
    val rawUrl = System.getenv("DATABASE_URL") ?: "postgresql://postgres:password@localhost:5432/tempo_vote"

    // Parse postgresql://user:pass@host:port/db into separate JDBC properties.
    // HikariCP's jdbcUrl does not reliably parse embedded credentials.
    val (jdbcUrl, dbUser, dbPass) = parseDbUrl(rawUrl)

    try {
        val hikari = HikariDataSource(HikariConfig().apply {
            this.jdbcUrl = jdbcUrl
            username = dbUser
            password = dbPass
            driverClassName = "org.postgresql.Driver"
            maximumPoolSize = 10
            connectionTimeout = 5_000   // 5s per connection attempt
            initializationFailTimeout = 30_000  // wait up to 30s on startup
        })

        Flyway.configure()
            .dataSource(hikari)
            .locations("classpath:db/migration")
            .load()
            .migrate()

        Database.connect(hikari)
        log.info("Database connected: $jdbcUrl (user: $dbUser)")
    } catch (e: Exception) {
        log.warn("Database unavailable — off-chain features (polls, communities) disabled: ${e.message}")
    }
}

// Returns Triple(jdbcUrl, username, password) from a postgresql:// or jdbc:postgresql:// URL.
private fun parseDbUrl(raw: String): Triple<String, String, String> {
    // Normalise: strip leading "jdbc:" if present
    val url = if (raw.startsWith("jdbc:")) raw.removePrefix("jdbc:") else raw
    // url is now postgresql://[user[:pass]@]host[:port]/database[?params]
    val noScheme = url.removePrefix("postgresql://")
    val (authority, pathAndQuery) = if ("/" in noScheme) {
        noScheme.substringBefore("/") to noScheme.substringAfter("/")
    } else {
        noScheme to ""
    }
    val (userInfo, hostPort) = if ("@" in authority) {
        authority.substringBefore("@") to authority.substringAfter("@")
    } else {
        "" to authority
    }
    val user = if (":" in userInfo) userInfo.substringBefore(":") else userInfo
    val pass = if (":" in userInfo) userInfo.substringAfter(":") else ""
    val jdbc = "jdbc:postgresql://$hostPort/$pathAndQuery"
    return Triple(jdbc, user, pass)
}
