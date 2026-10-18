"""Root-only configuration writer. Secret arrives on stdin, never argv/logs.
This tool installs configuration only; it never calls any model or edits study data.
"""
from pathlib import Path
from decimal import Decimal,InvalidOperation
import os,re,sys,uuid


def render(existing,key,mode,budget='0',calls='0'):
    if not re.fullmatch(r'[A-Za-z0-9_-]{16,200}',key):raise ValueError('invalid credential format')
    if mode not in ('install-disabled','prepare-enabled'):raise ValueError('invalid operation')
    try:amount=Decimal(budget);count=int(calls)
    except (ValueError,InvalidOperation):raise ValueError('invalid limits') from None
    if not amount.is_finite() or not 0<=amount<=100 or not 0<=count<=40:raise ValueError('invalid limits')
    if mode=='prepare-enabled' and (amount<=0 or count<=0):raise ValueError('positive explicit limits required')
    values={'DEEPSEEK_API_KEY':key,'BANYA_AI_ENABLED':'1' if mode=='prepare-enabled' else '0',
            'BANYA_AUTO_ENABLED':'1' if mode=='prepare-enabled' else '0',
            'DEEPSEEK_MONTHLY_BUDGET_USD':str(amount) if mode=='prepare-enabled' else '0',
            'DEEPSEEK_MONTHLY_CALLS':str(count) if mode=='prepare-enabled' else '0',
            'BANYA_AI_CONFIG_REVISION':uuid.uuid4().hex}
    # Preserve every unrelated setting; no shell sourcing or evaluation.
    lines=[line for line in existing.splitlines() if line.split('=',1)[0].strip() not in values]
    return '\n'.join(lines+[k+'='+v for k,v in values.items()])+'\n'


def main():
    try:
        if os.geteuid()!=0 or len(sys.argv)!=4:raise ValueError('root and reviewed limits required')
        target=Path('/etc/banya-sync.env')
        if target.is_symlink() or not target.is_file() or target.stat().st_uid!=0 or target.stat().st_mode&0o077:raise ValueError('protected environment required')
        key=sys.stdin.buffer.read(202).decode('ascii')
        result=render(target.read_text(),key,*sys.argv[1:])
        temporary=target.with_name('.banya-ai-'+uuid.uuid4().hex)
        fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as f:f.write(result);f.flush();os.fsync(f.fileno())
        os.replace(temporary,target)
    except Exception:
        print('AI configuration refused; no credential details emitted.',file=sys.stderr);return 1
    print('Protected configuration installed; no model request made. App approval required.')
    return 0

if __name__=='__main__':sys.exit(main())
