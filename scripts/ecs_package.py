"""ECS-only static package: explicit files, hashes, no code/data directories."""
import argparse
import hashlib
import io
from pathlib import Path
import tarfile

ASSETS=tuple('index.html update.html refresh.html refresh.js styles.css app.js study-assistant.js plan-import.js cloud-sync.js origin-transfer.js planner-core.js plan-data.js plan.json study-intelligence.js study-ui.js politics-core.js politics-plan-data.js politics-plan.json politics-ui.js sw.js manifest.webmanifest icons/icon-192.png icons/icon-512.png'.split())

def hashes(root):
    return ''.join(hashlib.sha256((root/name).read_bytes()).hexdigest()+'  '+name+'\n' for name in ASSETS).encode()

def package(root,destination):
    for name in ASSETS:
        path=root/name
        if not path.is_file() or path.is_symlink() or not path.stat().st_size:raise ValueError('Missing or unsafe static asset')
    with tarfile.open(destination,'w:gz') as tar:
        for name in ASSETS:tar.add(root/name,arcname=name,recursive=False)
        data=hashes(root);info=tarfile.TarInfo('SHA256SUMS');info.size=len(data);info.mode=0o644;tar.addfile(info,io.BytesIO(data))
    verify(destination)

def verify(archive):
    with tarfile.open(archive,'r:gz') as tar:
        members=tar.getmembers()
        if len(members)!=len(ASSETS)+1 or {m.name for m in members}!=set(ASSETS)|{'SHA256SUMS'}:raise ValueError('Unexpected package files')
        if any(not m.isfile() or m.size>4_000_000 for m in members):raise ValueError('Unsafe package entry')
        expected=''.join(hashlib.sha256(tar.extractfile(name).read()).hexdigest()+'  '+name+'\n' for name in ASSETS).encode()
        if tar.extractfile('SHA256SUMS').read()!=expected:raise ValueError('Package hash mismatch')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['build','verify']);p.add_argument('archive',type=Path);p.add_argument('--root',type=Path,default=Path('.'));args=p.parse_args()
    if args.action=='build':package(args.root,args.archive)
    else:verify(args.archive)
    print('ECS static allowlist and hashes verified; no private files packaged.')
