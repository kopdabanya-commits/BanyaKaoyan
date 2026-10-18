from playwright.sync_api import sync_playwright
from pathlib import Path
import os
out=Path(os.environ.get('BANYA_SCREENSHOTS','/tmp/banya-m73-screens'));out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in (360,390,412):
  page=browser.new_page(viewport={'width':width,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('BANYA_SMOKE_URL','http://127.0.0.1:8765/'));page.wait_for_selector('.student-task')
  for subject in ('english','politics'):
   page.locator('[data-action="switch-subject"][data-subject="'+subject+'"]').click()
   for view in ('today','calendar','stats','assistant','settings'):
    page.locator('.nav-tab[data-view="'+view+'"]').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,subject,view,'overflow')
    page.wait_for_timeout(200);page.screenshot(path=str(out/f'{width}-{subject}-{view}.png'),full_page=True)
   page.locator('.nav-tab[data-view="calendar"]').click()
   page.reload();page.wait_for_selector('.calendar')
   assert page.locator('.nav-tab[data-view="calendar"]').get_attribute('aria-current')=='page'
   day=page.locator('[data-action="cal-day"]:not([disabled]), [data-action="p-day"]:not([disabled])').first
   day.click();page.wait_for_selector('.day-detail-head')
   page.go_back();page.wait_for_selector('.calendar')
  assert not errors,errors
  page.close()
 browser.close()
print('PASS: 30 page/subject/width screenshots, no overflow or JS errors; refresh and calendar/back at all widths')
