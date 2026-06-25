package vote.tempo.testutil

import org.flywaydb.core.Flyway
import org.jetbrains.exposed.sql.Database
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.utility.DockerImageName

/**
 * Singleton Postgres container shared across all integration test classes in the JVM session.
 * Flyway migration runs once; each test class cleans its own tables in @BeforeEach.
 * Testcontainers registers its own JVM shutdown hook — no explicit stop() needed.
 */
object TestDatabase {

    val isDockerAvailable: Boolean by lazy {
        runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)
    }

    private val ready: Unit by lazy {
        val pg = PostgreSQLContainer(DockerImageName.parse("postgres:16-alpine")).apply { start() }
        Flyway.configure()
            .dataSource(pg.jdbcUrl, pg.username, pg.password)
            .load()
            .migrate()
        Database.connect(
            url      = pg.jdbcUrl,
            driver   = "org.postgresql.Driver",
            user     = pg.username,
            password = pg.password,
        )
        Unit
    }

    /** Call in @BeforeAll. Idempotent — container starts only on the first call. */
    fun setup() { ready }
}
