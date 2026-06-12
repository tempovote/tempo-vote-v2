#!/usr/bin/env python3
"""
Phase 2: Apply GA metadata (title + abstract) from pre-fetched JSON to DB.

Pre-conditions:
  1. Phase 1 (fetch_ga_metadata.py) has been run and output JSON is verified.
  2. Flyway V13 migration has been applied (columns title/abstract exist).

This script applies all UPDATEs inside a SINGLE transaction — either all rows
are updated or none (rolled back on any error). Safe to re-run.

Usage:
    python3 scripts/apply_ga_metadata.py backups/ga_metadata_mainnet_<timestamp>.json [--dry-run]
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path


def psql_exec(sql: str, dry_run: bool = False) -> str:
    """Execute SQL via docker exec psql. In dry_run mode, print but don't execute."""
    if dry_run:
        print(f"[DRY-RUN] {sql[:200]}")
        return ""
    result = subprocess.run(
        ["docker", "exec", "tempo-pg", "psql", "-U", "postgres", "-d", "tempo_vote",
         "-t", "-A", "-c", sql],
        capture_output=True, text=True, timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql error: {result.stderr.strip()}")
    return result.stdout.strip()


def check_columns_exist() -> bool:
    """Verify V13 migration has been applied (title + abstract columns exist)."""
    result = psql_exec("""
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'idx_governance_proposals'
          AND column_name IN ('title', 'abstract')
    """)
    return result.strip() == "2"


def escape_sql(s: str | None) -> str:
    """PostgreSQL-safe string escape (double single quotes)."""
    if s is None:
        return "NULL"
    escaped = s.replace("'", "''")
    return f"'{escaped}'"


def build_update_sql(items: list[dict], network: str) -> str:
    """Build a single transaction with all UPDATE statements."""
    lines = ["BEGIN;", ""]

    update_count = 0
    for item in items:
        title    = item.get("title")
        abstract = item.get("abstract")

        # Skip rows with no data to write
        if title is None and abstract is None:
            continue

        tx_hash = item["txHash"]
        idx     = item["index"]

        set_clauses = []
        if title is not None:
            set_clauses.append(f"title = {escape_sql(title)}")
        if abstract is not None:
            set_clauses.append(f"abstract = {escape_sql(abstract)}")

        lines.append(
            f"UPDATE idx_governance_proposals "
            f"SET {', '.join(set_clauses)} "
            f"WHERE network = '{network}' "
            f"  AND tx_hash = '{tx_hash}' "
            f"  AND index = {idx};"
        )
        update_count += 1

    lines += ["", "COMMIT;"]
    return "\n".join(lines), update_count


def main():
    parser = argparse.ArgumentParser(description="Apply pre-fetched GA metadata to DB")
    parser.add_argument("json_file", help="Output file from fetch_ga_metadata.py")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print SQL without executing")
    parser.add_argument("--sql-only", action="store_true",
                        help="Print SQL to stdout and exit (redirect to file)")
    args = parser.parse_args()

    # 1. Load JSON
    path = Path(args.json_file)
    if not path.exists():
        print(f"ERROR: File not found: {path}")
        sys.exit(1)

    data = json.loads(path.read_text())
    items   = data["items"]
    network = data["network"]

    print(f"=== Phase 2: Apply GA Metadata ===")
    print(f"  Source:  {path.name}")
    print(f"  Network: {network}")
    print(f"  Items:   {len(items)} total, {data['withTitle']} with title\n")

    # 2. Build SQL
    sql, update_count = build_update_sql(items, network)

    if args.sql_only:
        print(sql)
        sys.exit(0)

    print(f"  UPDATE statements to execute: {update_count}")
    print(f"  Skipped (no data):            {len(items) - update_count}\n")

    if update_count == 0:
        print("Nothing to update. Exiting.")
        sys.exit(0)

    # 3. Check V13 migration applied
    if not args.dry_run:
        print("Checking V13 migration status...")
        if not check_columns_exist():
            print("ERROR: Columns 'title' and 'abstract' not found in idx_governance_proposals.")
            print("       Apply V13 Flyway migration first (./gradlew :apps:api:flywayMigrate)")
            sys.exit(1)
        print("  ✓ V13 columns exist\n")

    # 4. Dry run preview
    if args.dry_run:
        print("--- SQL preview (first 20 statements) ---")
        for line in sql.splitlines()[:22]:
            print(line)
        print(f"... ({update_count} total UPDATE statements)")
        sys.exit(0)

    # 5. Confirm
    print(f"This will UPDATE {update_count} rows in idx_governance_proposals.")
    print("All updates run in a single transaction (rolled back on any error).")
    confirm = input("Proceed? [y/N] ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        sys.exit(0)

    # 6. Execute
    print("\nExecuting...")
    try:
        # Write SQL to temp file in container and execute
        sql_path = f"/tmp/ga_metadata_backfill_{network}.sql"
        write_result = subprocess.run(
            ["docker", "exec", "-i", "tempo-pg", "bash", "-c",
             f"cat > {sql_path}"],
            input=sql, text=True, capture_output=True,
        )
        if write_result.returncode != 0:
            raise RuntimeError(f"Failed to write SQL file: {write_result.stderr}")

        exec_result = subprocess.run(
            ["docker", "exec", "tempo-pg", "psql", "-U", "postgres", "-d", "tempo_vote",
             "-f", sql_path],
            capture_output=True, text=True, timeout=120,
        )
        if exec_result.returncode != 0:
            raise RuntimeError(f"SQL execution failed:\n{exec_result.stderr}")

        # Count how many rows actually changed
        affected = exec_result.stdout.count("UPDATE 1")
        print(f"\n  ✓ Done — {affected} rows updated")

        # Cleanup temp file
        subprocess.run(
            ["docker", "exec", "tempo-pg", "rm", "-f", sql_path],
            capture_output=True,
        )

    except RuntimeError as e:
        print(f"\n  ✗ FAILED (transaction rolled back): {e}")
        sys.exit(1)

    # 7. Verify
    verify = psql_exec(f"""
        SELECT COUNT(*) FROM idx_governance_proposals
        WHERE network = '{network}' AND title IS NOT NULL
    """)
    print(f"  DB rows with title: {verify.strip()}")
    print(f"\nPhase 2 complete. Restart the API to pick up new title data.")


if __name__ == "__main__":
    main()
