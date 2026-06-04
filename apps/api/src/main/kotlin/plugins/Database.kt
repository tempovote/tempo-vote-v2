package vote.tempo.plugins

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.application.*
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.sql.Database
import vote.tempo.db.Tables

fun Application.configureDatabase() {
    val dbUrl = System.getenv("DATABASE_URL")
        ?: "jdbc:postgresql://localhost:5432/tempo_vote"

    val hikari = HikariDataSource(HikariConfig().apply {
        jdbcUrl = dbUrl
        driverClassName = "org.postgresql.Driver"
        maximumPoolSize = 10
    })

    // Run Flyway migrations
    Flyway.configure()
        .dataSource(hikari)
        .locations("classpath:db/migration")
        .load()
        .migrate()

    Database.connect(hikari)
}
