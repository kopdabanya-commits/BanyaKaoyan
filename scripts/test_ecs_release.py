"""Synthetic archives and sandboxed paths; never contacts production."""
import hashlib
import io
from pathlib import Path
import shutil
import subprocess
import tarfile
import threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer

import pytest
from ecs_package import ASSETS, package, verify
from verify_ecs import verify as verify_site

ROOT=Path(__file__).resolve().parents[1]


def test_complete_ecs_archive_excludes_source_and_data(tmp_path):
    archive=tmp_path/'site.tgz';package(ROOT,archive)
    with tarfile.open(archive) as tar:
        assert {m.name for m in tar}==set(ASSETS)|{'SHA256SUMS'}
        assert all('server/' not in m.name and 'docs/' not in m.name for m in tar)
    verify(archive)


@pytest.mark.parametrize('name,link', [('server/private.sqlite3',False),('../index.html',False),('index.html',True)])
def test_extra_traversal_or_symlink_package_is_rejected(tmp_path,name,link):
    archive=tmp_path/'bad.tgz'
    with tarfile.open(archive,'w:gz') as tar:
        info=tarfile.TarInfo(name);info.type=tarfile.SYMTYPE if link else tarfile.REGTYPE
        info.linkname='/etc/private';tar.addfile(info,io.BytesIO())
    with pytest.raises(ValueError):verify(archive)


def test_package_rejects_missing_asset_and_hash_tampering(tmp_path):
    with pytest.raises(ValueError):package(tmp_path,tmp_path/'missing.tgz')
    original=tmp_path/'original.tgz';bad=tmp_path/'bad.tgz';package(ROOT,original)
    with tarfile.open(original) as src,tarfile.open(bad,'w:gz') as dest:
        for member in src:
            raw=src.extractfile(member).read()
            if member.name=='index.html':raw+=b'synthetic tamper';member.size=len(raw)
            dest.addfile(member,io.BytesIO(raw))
    with pytest.raises(ValueError):verify(bad)


def test_public_verifier_checks_complete_hashes_auth_and_hidden_files(tmp_path):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*_):pass
        def do_GET(self):
            path=self.path[1:]
            if path in ASSETS:status=200;body=(ROOT/path).read_bytes()
            elif path=='health':status=200;body=b'{"service":"banya-study-sync"}'
            elif path.startswith('v1/snapshot/'):status=401;body=b''
            else:status=404;body=b''
            self.send_response(status);self.send_header('Content-Security-Policy',"connect-src 'self' https://124.70.128.201;");self.end_headers();self.wfile.write(body)
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:verify_site('http://127.0.0.1:'+str(server.server_port),ROOT)
    finally:server.shutdown();server.server_close()


def test_failed_release_restores_old_link_config_and_never_replaces_db(tmp_path):
    # Run the real release algorithm on rewritten sandbox paths with fake system commands.
    stage=tmp_path/'root/banya-pwa-stage';stage.mkdir(parents=True)
    etc=tmp_path/'etc';(etc/'nginx/sites-available').mkdir(parents=True);(etc/'nginx/sites-enabled').mkdir()
    cert=etc/'letsencrypt/live/124.70.128.201';cert.mkdir(parents=True);(cert/'fullchain.pem').write_text('synthetic cert')
    live=etc/'nginx/sites-available/banya-sync';live.write_text('synthetic old config');(etc/'nginx/sites-enabled/banya-sync').symlink_to(live)
    base=tmp_path/'var/www/banya-pwa';(base/'old').mkdir(parents=True);(base/'current').symlink_to(base/'old')
    db=tmp_path/'var/lib/banya-sync/sync.sqlite3';db.parent.mkdir(parents=True);db.write_text('synthetic private data')
    package(ROOT,stage/'site.tgz');shutil.copy(ROOT/'scripts/ecs_package.py',stage);(stage/'nginx-ip.conf').write_text('synthetic new config')
    # Fail public validation after the switch; no network is used.
    (stage/'verify_ecs.py').write_text('raise SystemExit(1)')
    bin_dir=tmp_path/'bin';bin_dir.mkdir()
    for name,content in {'id':'echo 0','runuser':'cat >/dev/null; exit 0','chown':'exit 0','nginx':'exit 0','systemctl':'exit 0','sleep':'exit 0'}.items():
        path=bin_dir/name;path.write_text('#!/bin/sh\n'+content+'\n');path.chmod(0o755)
    source=(ROOT/'server/banya-sync/install-pwa-fallback.sh').read_text()
    for prefix in ('/root/','/etc/','/var/www/'):
        source=source.replace(prefix,str(tmp_path/prefix.lstrip('/'))+'/')
    script=tmp_path/'release.sh';script.write_text(source)
    import os
    result=subprocess.run(['bash',str(script),'a'*40],env={**os.environ,'PATH':str(bin_dir)+':'+os.environ['PATH']},capture_output=True)
    assert result.returncode!=0
    assert (base/'current').resolve()==base/'old'
    assert live.read_text()=='synthetic old config'
    assert db.read_text()=='synthetic private data'
    assert not (base/'releases'/('a'*40)).exists()
    assert list((base/'releases').glob('*.failed.*'))
    # A failed attempt can be retried, then repeated without overwriting immutable files.
    (stage/'verify_ecs.py').write_text('raise SystemExit(0)')
    rerun=lambda:subprocess.run(['bash',str(script),'a'*40],env={**os.environ,'PATH':str(bin_dir)+':'+os.environ['PATH']},capture_output=True)
    assert rerun().returncode==0
    active=base/'releases'/('a'*40);assert (base/'current').resolve()==active
    assert rerun().returncode==0
    (active/'app.js').write_text('synthetic tamper')
    assert rerun().returncode!=0
    assert (base/'current').resolve()==active and db.read_text()=='synthetic private data'


def test_repeated_release_requires_identical_members_bytes_and_no_symlinks(tmp_path):
    from ecs_package import verify_installed
    archive=tmp_path/'site.tgz';package(ROOT,archive)
    release=tmp_path/'release';release.mkdir()
    with tarfile.open(archive) as tar:tar.extractall(release,filter='data')
    verify_installed(release,archive);verify_installed(release,archive)
    (release/'app.js').write_text('synthetic tamper')
    with pytest.raises(ValueError):verify_installed(release,archive)
    (release/'app.js').unlink();(release/'app.js').symlink_to(ROOT/'app.js')
    with pytest.raises(ValueError):verify_installed(release,archive)
