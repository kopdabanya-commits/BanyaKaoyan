"""Read-only deployed UI smoke. Fresh browser, no owner token or private records."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'https://124.70.128.201'
OUT = Path('artifacts/production-public')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    errors, writes = [], []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(**({'executable_path': os.environ['BANYA_CHROMIUM']} if os.environ.get('BANYA_CHROMIUM') else {}))
        context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
        def readonly(route):
            req = route.request
            if req.method not in ('GET', 'HEAD', 'OPTIONS') or not req.url.startswith(BASE + '/'):
                writes.append(req.method)
                route.abort()
            else:
                route.continue_()
        context.route('**/*', readonly)
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(type(e).__name__))
        page.goto(BASE + '/', wait_until='networkidle')
        page.locator('.nav-tab').first.wait_for()
        for subject in ('english', 'politics'):
            page.locator('.nav-tab[data-view="today"]').click()
            page.locator('[data-action="switch-subject"][data-subject="' + subject + '"]').click()
            for view in ('today', 'calendar', 'stats', 'assistant', 'settings'):
                page.locator('.nav-tab[data-view="' + view + '"]').click()
                page.wait_for_timeout(150)
                assert page.locator('.nav-tab[aria-current="page"]').get_attribute('data-view') == view
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                page.screenshot(path=str(OUT / (subject + '-' + view + '.png')))
            page.reload(wait_until='networkidle')
            assert page.locator('.nav-tab[aria-current="page"]').get_attribute('data-view') == 'settings'
        assert not errors, 'Browser JavaScript error'
        assert not writes, 'Unexpected write or external request attempted'
        (OUT / 'report.txt').write_text('Public deployed HTTPS UI: both subjects, five tabs, refresh restoration, no overflow or JS errors PASS. Fresh unauthenticated browser; no private data, writes or model calls. Not Android acceptance.\n')
        browser.close()


if __name__ == '__main__':
    main()
