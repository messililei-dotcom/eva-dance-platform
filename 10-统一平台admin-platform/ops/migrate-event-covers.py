#!/usr/bin/env python3
"""Safely consolidate event covers into public/uploads/event-covers.

The command is intentionally apply-gated. It backs up SQLite before changing
cover_url, validates every source as an actual supported image, and leaves
unresolved records untouched while writing a complete JSON report.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def detect_extension(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def read_source(item: dict, archive_dir: Path) -> tuple[bytes, str]:
    archive_file = item.get("archive_file")
    if archive_file:
        source = archive_dir / archive_file
        if not source.is_file():
            raise FileNotFoundError(f"archive file missing: {source}")
        return source.read_bytes(), f"archive:{archive_file}"
    source_url = item.get("source_url")
    if not source_url:
        raise FileNotFoundError("no recoverable source")
    request = urllib.request.Request(source_url, headers={"User-Agent": "event-cover-migrator/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read(20 * 1024 * 1024 + 1), f"url:{source_url}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True, type=Path)
    parser.add_argument("--app-dir", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--archive-dir", required=True, type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    upload_dir = args.app_dir / "public" / "uploads" / "event-covers"
    backup_root = args.app_dir / "backups"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = backup_root / f"event-covers-migration-{timestamp}"
    report: dict = {"timestamp": timestamp, "apply": args.apply, "migrated": [], "unresolved": []}

    connection = sqlite3.connect(args.db)
    rows = {int(row[0]): row[1:] for row in connection.execute("SELECT id, name, COALESCE(cover_url, '') FROM event_competitions")}

    with tempfile.TemporaryDirectory(prefix="event-cover-migration-") as temporary:
        prepared: list[tuple[int, str, Path, str, str]] = []
        temporary_dir = Path(temporary)
        for item in manifest:
            event_id = int(item["id"])
            row = rows.get(event_id)
            if row is None:
                report["unresolved"].append({"id": event_id, "reason": "event no longer exists"})
                continue
            actual_name, old_url = row
            expected_name = item.get("name", "")
            if expected_name and actual_name != expected_name:
                report["unresolved"].append({"id": event_id, "reason": "name mismatch", "expected": expected_name, "actual": actual_name})
                continue
            try:
                data, source = read_source(item, args.archive_dir)
                if len(data) > 20 * 1024 * 1024:
                    raise ValueError("image exceeds 20MB migration limit")
                extension = detect_extension(data)
                if not extension:
                    raise ValueError("source is not a supported image")
                filename = f"event-{event_id}-archive.{extension}"
                temporary_file = temporary_dir / filename
                temporary_file.write_bytes(data)
                new_url = f"/uploads/event-covers/{filename}"
                prepared.append((event_id, new_url, temporary_file, source, old_url))
            except Exception as error:
                report["unresolved"].append({"id": event_id, "name": actual_name, "reason": str(error), "original_url": item.get("original_url", old_url)})

        if args.apply:
            run_dir.mkdir(parents=True, exist_ok=False)
            backup_db = run_dir / "admin-before.db"
            backup_connection = sqlite3.connect(backup_db)
            connection.backup(backup_connection)
            backup_connection.close()
            upload_dir.mkdir(parents=True, exist_ok=True)
            with connection:
                for event_id, new_url, temporary_file, source, old_url in prepared:
                    destination = upload_dir / temporary_file.name
                    staged = destination.with_suffix(destination.suffix + ".tmp")
                    shutil.copyfile(temporary_file, staged)
                    staged.replace(destination)
                    connection.execute("UPDATE event_competitions SET cover_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_url, event_id))
                    report["migrated"].append({"id": event_id, "from": old_url, "to": new_url, "source": source, "bytes": destination.stat().st_size})
            report_path = run_dir / "migration-report.json"
            report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps({"backup": str(backup_db), "report": str(report_path), "migrated": len(report["migrated"]), "unresolved": len(report["unresolved"])}, ensure_ascii=False))
        else:
            report["migrated"] = [{"id": event_id, "to": new_url, "source": source} for event_id, new_url, _, source, _ in prepared]
            print(json.dumps(report, ensure_ascii=False, indent=2))
    connection.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
