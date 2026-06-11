#!/bin/bash
set -e
superset db upgrade
superset fab create-admin \
    --username admin \
    --firstname Admin \
    --lastname Admin \
    --email admin@tempo.vote \
    --password admin
superset init
echo "✅ Superset initialized. Login: http://localhost:8088 (admin/admin)"
