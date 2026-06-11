import os

# Superset metadata — stored trong named volume, không liên quan đến tempo_vote
SQLALCHEMY_DATABASE_URI = "sqlite:////app/superset_home/superset.db"

# Redis cache
REDIS_HOST = os.environ.get("REDIS_HOST", "superset-redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
}
DATA_CACHE_CONFIG = CACHE_CONFIG

# Feature flags
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
}

# Cho phép upload CSV / Excel để khám phá nhanh
UPLOAD_FOLDER = "/app/superset_home/uploads/"
