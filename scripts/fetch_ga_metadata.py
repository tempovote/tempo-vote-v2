#!/usr/bin/env python3
"""
Phase 1: Fetch GA metadata (title + abstract) for all governance proposals.

Reads anchor URLs from DB, fetches metadata from IPFS/HTTPS,
saves results to backups/ga_metadata_<timestamp>.json.

Zero DB writes — safe to run multiple times.
Run Phase 2 (backfill) only after reviewing the JSON output.

Usage:
    python3 scripts/fetch_ga_metadata.py [--network mainnet|preprod] [--concurrency 10]
"""

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

# ── Configuration ─────────────────────────────────────────────────────────────

IPFS_GATEWAYS = [
    "https://most-brass-sun.quicknode-ipfs.com/ipfs/{}",  # fastest in tests (~1s)
    "https://gateway.pinata.cloud/ipfs/{}",               # fallback (~4s)
    "https://dweb.link/ipfs/{}",                          # fallback
]

TIMEOUT_S       = 8     # per-request timeout
MAX_RETRIES     = 3     # retry across different gateways
CONCURRENCY     = 10    # parallel fetches


# ── DB helpers ────────────────────────────────────────────────────────────────

def psql(sql: str) -> str:
    """Run a SQL query via docker exec and return stdout."""
    result = subprocess.run(
        ["docker", "exec", "tempo-pg", "psql", "-U", "postgres", "-d", "tempo_vote",
         "-t", "-A", "-F", "\t", "-c", sql],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql error: {result.stderr.strip()}")
    return result.stdout.strip()


def load_anchor_urls(network: str) -> list[dict]:
    """Return [{tx_hash, index, anchor_url, action_type}] for all GAs in DB."""
    rows = psql(f"""
        SELECT tx_hash, index, anchor_url, action_type
        FROM idx_governance_proposals
        WHERE network = '{network}'
          AND anchor_url IS NOT NULL
        ORDER BY submitted_epoch DESC, submitted_slot DESC
    """)
    result = []
    for line in rows.splitlines():
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        result.append({
            "txHash":     parts[0].strip(),
            "index":      int(parts[1].strip()),
            "anchorUrl":  parts[2].strip(),
            "actionType": parts[3].strip(),
        })
    return result


# ── Fetch helpers ─────────────────────────────────────────────────────────────

IPFS_HTTP_PREFIXES = (
    "https://ipfs.io/ipfs/",
    "http://ipfs.io/ipfs/",
    "https://gateway.ipfs.io/ipfs/",
)


def resolve_url(anchor_url: str, gateway_idx: int = 0) -> str:
    """
    Convert anchor URL to a resolvable HTTP URL.
    - ipfs:// → QuickNode (or fallback) gateway
    - https://ipfs.io/ipfs/... → re-route to QuickNode (ipfs.io is often blocked)
    - Other HTTPS → pass through as-is
    """
    # Re-route ipfs.io HTTP URLs to faster/accessible gateways
    for prefix in IPFS_HTTP_PREFIXES:
        if anchor_url.startswith(prefix):
            cid = anchor_url[len(prefix):].split("/")[0]
            template = IPFS_GATEWAYS[gateway_idx % len(IPFS_GATEWAYS)]
            return template.format(cid)

    if anchor_url.startswith("https://") or anchor_url.startswith("http://"):
        return anchor_url

    # Extract CID: ipfs://Qm... or ipfs://bafkrei...
    cid = anchor_url.removeprefix("ipfs://").strip("/").split("/")[0]
    template = IPFS_GATEWAYS[gateway_idx % len(IPFS_GATEWAYS)]
    return template.format(cid)


def parse_metadata(data: dict) -> tuple[str | None, str | None]:
    """
    Extract (title, abstract) from CIP-100/CIP-108 metadata JSON.
    Handles nested body object and flat structure.
    """
    body = data.get("body", data)
    if not isinstance(body, dict):
        body = data

    title    = body.get("title") or data.get("title")
    abstract = body.get("abstract") or data.get("abstract")

    # Trim whitespace and collapse internal newlines in abstract
    if isinstance(title, str):
        title = title.strip()[:500]  # safety cap
    if isinstance(abstract, str):
        abstract = re.sub(r"\s+", " ", abstract.strip())[:2000]

    return title or None, abstract or None


def fetch_one_sync(anchor_url: str) -> tuple[str | None, str | None, str | None]:
    """
    Fetch title and abstract for a single anchor URL (stdlib only, no aiohttp).
    Returns (title, abstract, error_reason).
    Tries multiple gateways for IPFS URLs.
    """
    import urllib.request
    import urllib.error

    is_ipfs = not anchor_url.startswith("http")
    attempts = MAX_RETRIES if is_ipfs else 1

    for attempt in range(attempts):
        url = resolve_url(anchor_url, gateway_idx=attempt)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "tempo-vote/1.0"})
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
                if resp.status != 200:
                    continue
                text = resp.read().decode("utf-8", errors="replace")
                data = json.loads(text)
                title, abstract = parse_metadata(data)
                if title:
                    return title, abstract, None
                return None, abstract, "no_title_field"
        except urllib.error.HTTPError as e:
            if attempt == attempts - 1:
                return None, None, f"HTTP {e.code}"
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == attempts - 1:
                return None, None, f"URLError: {str(e)[:120]}"
        except json.JSONDecodeError as e:
            return None, None, f"JSONDecodeError: {str(e)[:80]}"
        except Exception as e:
            return None, None, f"unexpected: {str(e)[:120]}"

    return None, None, "all_gateways_failed"


async def fetch_all(rows: list[dict], concurrency: int) -> list[dict]:
    """Fetch metadata for all rows using thread pool (stdlib, no aiohttp)."""
    import concurrent.futures

    results = [None] * len(rows)
    total = len(rows)
    done_count = 0
    lock = asyncio.Lock()

    loop = asyncio.get_event_loop()

    async def fetch_row(idx: int, row: dict):
        nonlocal done_count
        title, abstract, error = await loop.run_in_executor(
            None, fetch_one_sync, row["anchorUrl"]
        )
        async with lock:
            done_count += 1
            status = "✓" if title else ("~" if error == "no_title_field" else "✗")
            short_url = row["anchorUrl"][:60]
            label = (title[:50] if title else error) or ""
            print(f"  [{done_count:3d}/{total}] {status} {short_url}  {label}")
        results[idx] = {**row, "title": title, "abstract": abstract, "error": error}

    sem = asyncio.Semaphore(concurrency)

    async def bounded(idx, row):
        async with sem:
            await fetch_row(idx, row)

    await asyncio.gather(*[bounded(i, r) for i, r in enumerate(rows)])
    return results


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fetch GA title/abstract from anchor URLs")
    parser.add_argument("--network",     default="mainnet",  choices=["mainnet", "preprod"])
    parser.add_argument("--concurrency", default=CONCURRENCY, type=int)
    parser.add_argument("--output",      default=None, help="Override output file path")
    args = parser.parse_args()

    print(f"=== GA Metadata Fetcher — network={args.network} ===\n")

    # 1. Load anchor URLs from DB
    print("Loading anchor URLs from DB...")
    rows = load_anchor_urls(args.network)
    print(f"  Found {len(rows)} GAs with anchor URLs\n")

    if not rows:
        print("No rows found. Is the DB running?")
        sys.exit(1)

    # 2. Fetch metadata
    print(f"Fetching metadata (concurrency={args.concurrency}, timeout={TIMEOUT_S}s)...")
    print("  ✓ = title found  ~ = no title field  ✗ = fetch failed\n")

    start = datetime.now(timezone.utc)
    results = asyncio.run(fetch_all(rows, args.concurrency))
    elapsed = (datetime.now(timezone.utc) - start).total_seconds()

    # 3. Compute stats
    total      = len(results)
    with_title = sum(1 for r in results if r["title"])
    no_title   = sum(1 for r in results if not r["title"] and r["error"] == "no_title_field")
    failed     = sum(1 for r in results if r["error"] and r["error"] != "no_title_field")

    print(f"\n{'='*60}")
    print(f"Results ({elapsed:.1f}s elapsed):")
    print(f"  Total:           {total}")
    print(f"  Title resolved:  {with_title}  ({with_title/total*100:.1f}%)")
    print(f"  No title field:  {no_title}")
    print(f"  Fetch failed:    {failed}")

    if failed > 0:
        print(f"\n  Failed GAs:")
        for r in results:
            if r["error"] and r["error"] != "no_title_field":
                print(f"    {r['txHash'][:16]}#{r['index']}  {r['anchorUrl'][:60]}")
                print(f"      reason: {r['error']}")

    # 4. Save output
    out_dir = Path(__file__).parent.parent / "backups"
    out_dir.mkdir(exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path  = Path(args.output) if args.output else out_dir / f"ga_metadata_{args.network}_{timestamp}.json"

    payload = {
        "fetchedAt":   datetime.now(timezone.utc).isoformat(),
        "network":     args.network,
        "total":       total,
        "withTitle":   with_title,
        "noTitleField": no_title,
        "fetchFailed": failed,
        "items":       results,
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    print(f"\n  Saved → {out_path}")
    print(f"\nNext step:")
    print(f"  Review the JSON file, then run Phase 2 when coverage is satisfactory.")
    print(f"  Phase 2: python3 scripts/apply_ga_metadata.py {out_path}")

    # Exit code: 0 if ≥90% titles resolved, 1 otherwise (useful for CI)
    coverage = with_title / total if total > 0 else 0
    sys.exit(0 if coverage >= 0.9 else 1)


if __name__ == "__main__":
    main()
