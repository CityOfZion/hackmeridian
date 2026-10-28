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
target = backups / time.strftime('transfers-%Y%m%d-%H%M%S.sqlite', time.gmtime())
with sqlite3.connect(f'file:{data / "transfers.sqlite"}?mode=ro', uri=True) as source:
    with sqlite3.connect(target) as destination:
        source.backup(destination)
        if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Transfer backup integrity check failed')
for path in backups.glob('transfers-*.sqlite'):
    if path != target and path.stat().st_mtime < time.time() - 7 * 86400:
        path.unlink()
