package vote.tempo.plugins

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.application.*
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.sql.Database

fun Application.configureDatabase() {
    val dbUrl = (System.getenv("DATABASE_URL") ?: "jdbc:postgresql://localhost:5432/tempo_vote")
        .let { if (it.startsWith("postgresql://")) "jdbc:$it" else it }

    try {
        val hikari = HikariDataSource(HikariConfig().apply {
            jdbcUrl = dbUrl
            driverClassName = "org.postgresql.Driver"
            maximumPoolSize = 10
            connectionTimeout = 3000       // 3s per connection attempt
            initializationFailTimeout = 1  // fail fast if DB unavailable at startup
        })

        Flyway.configure()
            .dataSource(hikari)
            .locations("classpath:db/migration")
            .load()
            .migrate()

        Database.connect(hikari)
        log.info("Database connected: $dbUrl")
    } catch (e: Exception) {
        log.warn("Database unavailable — off-chain features (polls, communities) disabled: ${e.message}")
    }
}
