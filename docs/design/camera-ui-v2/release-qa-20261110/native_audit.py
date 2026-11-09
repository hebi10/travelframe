"""Explicit-device, non-seeding QA of the installed Play build."""
import argparse
import json
import re
import subprocess
import time
from pathlib import Path
import xml.etree.ElementTree as ET

ADB = 'D:/Android/Sdk/platform-tools/adb.exe'
SERIAL = 'emulator-5558'
AVD = 'BodyFrame_Release_QA_20261110_26092625'
OUT = Path('D:/dev_app/travelframe/docs/design/camera-ui-v2/release-qa-20261110')

def adb(*args, binary=False):
    value = subprocess.check_output([ADB, '-s', SERIAL, *args], timeout=30)
    return value if binary else value.decode('utf-8', 'replace')

def guard():
    if AVD not in adb('emu', 'avd', 'name').splitlines():
        raise RuntimeError('QA AVD identity mismatch; original devices must not be changed')

def event(**value):
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / 'actions.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps({'atUtc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'serial': SERIAL, **value}, ensure_ascii=False) + '\n')

def tree():
    adb('shell', 'uiautomator', 'dump', '/sdcard/bodyframe-release-qa.xml')
    return adb('exec-out', 'cat', '/sdcard/bodyframe-release-qa.xml')

def nodes(xml):
    return list(ET.fromstring(xml).iter('node'))

def choose(xml, label, after_label=None):
    items = []
    for node in nodes(xml):
        bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
        if len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]:
            items.append(node)
    matched = [n for n in items if n.get('content-desc') == label]
    if not matched:
        matched = [n for n in items if n.get('text') == label]
    if after_label:
        anchor = choose(xml, after_label)
        anchor_bottom = int(re.findall(r'\d+', anchor.get('bounds'))[3])
        matched = [n for n in matched if int(re.findall(r'\d+', n.get('bounds'))[1]) >= anchor_bottom]
        matched.sort(key=lambda n: int(re.findall(r'\d+', n.get('bounds'))[1]))
        matched = matched[:1]
    if len(matched) != 1:
        raise RuntimeError(f'{label}: expected one observed target, got {len(matched)}')
    return matched[0]

def tap_node(node, label):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
    if x2 <= x1 or y2 <= y1:
        raise RuntimeError('Target has empty bounds')
    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
    event(action='tap', label=label, bounds=[x1,y1,x2,y2])

def capture(label, xml=None):
    OUT.mkdir(parents=True, exist_ok=True)
    xml = xml or tree()
    (OUT / f'{label}.xml').write_text(xml, encoding='utf-8')
    (OUT / f'{label}.png').write_bytes(adb('exec-out', 'screencap', '-p', binary=True))
    event(action='capture', name=label)
    return xml

def show(xml):
    print(json.dumps([{'text': n.get('text'), 'description': n.get('content-desc'), 'bounds': n.get('bounds'), 'checked': n.get('checked')} for n in nodes(xml) if n.get('text') or n.get('content-desc')], ensure_ascii=False, indent=2))

if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--tap')
    parser.add_argument('--after')
    parser.add_argument('--capture')
    parser.add_argument('--expect')
    parser.add_argument('--back', action='store_true')
    parser.add_argument('--quiet', action='store_true')
    parser.add_argument('--scroll-up', action='store_true')
    parser.add_argument('--capture-and-measure', action='store_true')
    parser.add_argument('--background-resume', action='store_true')
    options = parser.parse_args()
    guard()
    if options.scroll_up:
        items = [n for n in nodes(tree()) if n.get('scrollable') == 'true']
        if len(items) != 1:
            raise RuntimeError(f'Expected one observed scroll view, got {len(items)}')
        x1, y1, x2, y2 = map(int, re.findall(r'\d+', items[0].get('bounds', '')))
        x = (x1+x2)//2
        start, end = int(y1+(y2-y1)*0.82), int(y1+(y2-y1)*0.25)
        adb('shell', 'input', 'swipe', str(x), str(start), str(x), str(end), '350')
        event(action='scroll-up', bounds=[x1,y1,x2,y2], start=[x,start], end=[x,end])
    if options.tap:
        tap_node(choose(tree(), options.tap, options.after), f'{options.after} > {options.tap}' if options.after else options.tap)
    if options.back:
        adb('shell', 'input', 'keyevent', '4')
        event(action='back')
    if options.background_resume:
        adb('shell', 'input', 'keyevent', '3')
        event(action='system-home')
        time.sleep(1)
        capture('39-system-home')
        adb('shell', 'am', 'start', '-W', '-n', 'com.haebi.photoguide/.MainActivity')
        event(action='resume-installed-release-app')
    if options.capture_and_measure:
        tap_node(choose(tree(), '사진 촬영'), '사진 촬영')
        started = time.monotonic()
        while time.monotonic() - started < 10:
            xml = tree()
            if any(n.get('text') == '수치 기록' or n.get('content-desc') == '수치 기록' for n in nodes(xml)):
                (OUT / '20-capture-measurement-prompt.xml').write_text(xml, encoding='utf-8')
                tap_node(choose(xml, '수치 기록'), '수치 기록')
                event(check='capture-to-measurement-prompt', result='PASS', secondsAfterShutter=round(time.monotonic()-started, 3))
                break
        else:
            capture('20-capture-unexpected-state', xml)
            event(check='capture-to-measurement-prompt', result='NOT_OBSERVED')
            raise RuntimeError('Measurement prompt was not observed; no guessed taps sent')
    xml = capture(options.capture) if options.capture else tree()
    if options.expect:
        if options.expect not in xml:
            raise RuntimeError(f'Expected marker missing: {options.expect}')
        event(check=options.expect, result='PASS', evidence=options.capture)
    if options.quiet:
        print(json.dumps({'capture': options.capture, 'expect': options.expect, 'result': 'PASS'}, ensure_ascii=False))
    else:
        show(xml)
