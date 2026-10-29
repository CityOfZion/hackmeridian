#!/usr/bin/env python3
"""Consistent local SQLite snapshots. These are not off-instance disaster recovery."""
import os
import sqlite3
import time
from pathlib import Path

os.umask(0o077)
data = Path('/var/lib/vaultpass')
backups = data / 'backups'
backups.mkdir(mode=0o700, exist_ok=True)
for name in ('transfers', 'backups', 'freeze'):
    database = data / f'{name}.sqlite'
    # Enrollment journal is created lazily on first account discovery or backup use.
    if name != 'transfers' and not database.exists():
        continue
    target = backups / time.strftime(f'{name}-%Y%m%d-%H%M%S.sqlite', time.gmtime())
    with sqlite3.connect(f'file:{database}?mode=ro', uri=True) as source:
        with sqlite3.connect(target) as destination:
            source.backup(destination)
            if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError(f'{name} snapshot integrity check failed')
    for path in backups.glob(f'{name}-*.sqlite'):
        if path != target and path.stat().st_mtime < time.time() - 7 * 86400:
            path.unlink()
