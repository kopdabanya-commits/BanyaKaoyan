"""Server gate only: never grant subjects, alter plans, or replace AI approval."""
from pathlib import Path
import os
import sqlite3
import sys
import uuid


def render(existing, enabled):
    if type(enabled) is not bool:
        raise ValueError('boolean gate required')
    lines = [line for line in existing.splitlines()
             if line.split('=', 1)[0].strip() != 'BANYA_AUTO_ENABLED']
    return '\n'.join(lines + ['BANYA_AUTO_ENABLED=' + str(int(enabled))]) + '\n'


def assert_inactive(db):
    # Run with the service stopped, so no owner request can race this check.
    with sqlite3.connect('file:' + str(db) + '?mode=ro', uri=True) as con:
        if con.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise ValueError('database integrity failed')
        if con.execute('SELECT 1 FROM auto_control WHERE enabled=1').fetchone():
            raise ValueError('pause existing master control before server enable')
        if con.execute('SELECT 1 FROM auto_permissions WHERE enabled=1').fetchone():
            raise ValueError('pause existing subject grants before server enable')
        if con.execute("SELECT 1 FROM ai_requests WHERE status='pending'").fetchone():
            raise ValueError('AI request in progress; wait before restart')


def main():
    try:
        if os.geteuid() != 0 or sys.argv[1:] not in (['enable-ready'], ['disable']):
            raise ValueError('reviewed root operation required')
        target = Path('/etc/banya-sync.env')
        if target.is_symlink() or not target.is_file() or target.stat().st_uid != 0 or target.stat().st_mode & 0o077:
            raise ValueError('protected environment required')
        existing = target.read_text()
        enabled = sys.argv[1] == 'enable-ready'
        if enabled:
            settings = dict(line.split('=', 1) for line in existing.splitlines()
                            if '=' in line and not line.lstrip().startswith('#'))
            assert_inactive(Path(settings.get('BANYA_DB_PATH', '/var/lib/banya-sync/sync.sqlite3')))
        temporary = target.with_name('.banya-auto-' + uuid.uuid4().hex)
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, 'w') as stream:
                stream.write(render(existing, enabled)); stream.flush(); os.fsync(stream.fileno())
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
        print('Server gate updated. Subject permissions and AI approval unchanged.')
    except Exception:
        raise SystemExit('Automatic-management gate refused; no private details emitted.') from None


if __name__ == '__main__':
    main()
