"""Non-seeding native camera QA. Every device must be explicitly selected."""
import argparse
import json
import re
import subprocess
import time
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

ADB = r'D:/Android/Sdk/platform-tools/adb.exe'
sys.stdout.reconfigure(encoding='utf-8')

class Device:
    def __init__(self, serial):
        self.serial = serial

    def adb(self, *args):
        return subprocess.check_output([ADB, '-s', self.serial, *args], encoding='utf-8', errors='replace')

    def tree(self):
        self.adb('shell', 'uiautomator', 'dump', '/sdcard/camera-v2.xml')
        return self.adb('exec-out', 'cat', '/sdcard/camera-v2.xml')

    def tap(self, label):
        root = ET.fromstring(self.tree())
        matches = [n for n in root.iter('node') if n.get('content-desc') == label]
        if not matches:
            matches = [n for n in root.iter('node') if n.get('text') == label]
        if len(matches) != 1:
            raise RuntimeError(f'{label}: expected one target, got {len(matches)}')
        node = matches[0]
        x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
        if x2 <= x1 or y2 <= y1:
            raise RuntimeError(f'{label}: invalid bounds')
        x, y = (x1+x2)//2, (y1+y2)//2
        for overlay in root.iter('node'):
            if overlay.get('content-desc') == 'Tools':
                ox1, oy1, ox2, oy2 = map(int, re.findall(r'\d+', overlay.get('bounds')))
                if ox1 <= x <= ox2 and oy1 <= y <= oy2:
                    x, y = x1 + 6, y1 + 6
        self.adb('shell', 'input', 'tap', str(x), str(y))

    def capture(self, path, expect=None):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        tree = self.tree()
        if expect and expect not in tree:
            raise RuntimeError(f'Expected screen marker missing: {expect}')
        path.with_suffix('.xml').write_text(tree, encoding='utf-8')
        self.adb('shell', 'screencap', '-p', '/sdcard/camera-v2.png')
        self.adb('pull', '/sdcard/camera-v2.png', str(path))
        return str(path)

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--serial', required=True)
    p.add_argument('--tap')
    p.add_argument('--capture')
    p.add_argument('--back', action='store_true')
    args = p.parse_args()
    d = Device(args.serial)
    if args.tap:
        d.tap(args.tap)
    if args.back:
        d.adb('shell', 'input', 'keyevent', '4')
    if args.capture:
        print(d.capture(args.capture))
    elif not args.tap and not args.back:
        root = ET.fromstring(d.tree())
        print(json.dumps([{'text': n.get('text'), 'description': n.get('content-desc'), 'bounds': n.get('bounds'), 'selected': n.get('selected'), 'checked': n.get('checked')} for n in root.iter('node') if n.get('text') or n.get('content-desc')], ensure_ascii=False, indent=2))
