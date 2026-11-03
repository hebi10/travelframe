#!/usr/bin/env python3
"""Native APK screenshots on a disposable emulator, with local-only guest fixtures.

Never run against a physical device or an existing user's installation. This
script verifies qemu, then replaces only this package's emulator RKStorage DB.
No app QA route, production credentials, login, purchase or cloud call is used.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shlex
import sqlite3
import struct
import subprocess
import tempfile
import time
from urllib.parse import urlencode
import xml.etree.ElementTree as ET

PACKAGE = 'com.haebi.photoguide'
PROJECT = 'qa-demo-project'
PHOTO = 'qa-demo-photo-1'
ROOT = Path(__file__).resolve().parents[1]
PROFILES = [('mobile', '720x1600', 320), ('tablet', '1200x1920', 240)]


def fixture_values(app_dir, populated=True):
    """Mirror the versioned schemas in lib/*-library.ts; all values are synthetic."""
    photos = []
    measurements = []
    dates = ['2026-10-01T09:00:00.000Z', '2026-10-15T09:00:00.000Z', '2026-11-01T09:00:00.000Z']
    for index, date in enumerate(dates, 1):
        photo_id = f'qa-demo-photo-{index}'
        uri = f'file://{app_dir}/files/photos/{PROJECT}/photo-{photo_id}.jpg'
        preview = f'file://{app_dir}/files/photo-previews/{PROJECT}/photo-{photo_id}.jpg'
        photos.append(dict(id=photo_id, uri=uri, previewUri=preview, createdAt=date,
                           width=1080, height=2400, ratioLabel='Original', kind='original',
                           edited=False, addedToVideo=False, projectId=PROJECT,
                           sequence=index, localFileStatus='available'))
        measurements.append(dict(id=f'qa-demo-measurement-{index}', projectId=PROJECT,
                                 photoId=photo_id, sequence=index, recordedAt=date,
                                 weightKg=72-index*0.5, bodyFatPercent=21-index*0.3,
                                 skeletalMuscleKg=30, waistCm=84-index,
                                 note='QA synthetic sample', source='manual'))
    project = dict(id=PROJECT, name='QA 데모 · 몸의 변화', createdAt=dates[0], updatedAt=dates[-1],
                   targetPhotoCount=100, referenceMode='first', coverPhotoId=photos[-1]['id'], archived=False)
    values = {
        'body-frame.projects.v1': [project] if populated else [],
        'travel-frame.photos.v1': photos if populated else [],
        'body-frame.measurements.v1': measurements if populated else [],
        'body-frame.measurement-settings.v1': {PROJECT: dict(enabled=True,
            fields=dict(weight=True, bodyFat=True, skeletalMuscle=True, waist=True),
            primaryMetric='weight', promptAfterCapture=False)} if populated else {},
        'travel-frame.videos.v1': [],
        'travel-frame.settings.v1': dict(storageMode='local_only', cloudBackupEnabled=False,
            themeMode='dark', cameraFacing='back', referencePhotoVisible=True),
    }
    encoded = {key: json.dumps(value, ensure_ascii=False) for key, value in values.items()}
    encoded['body-frame.stage-2-migration.v1'] = 'completed'
    if populated:
        encoded['body-frame.last-active-project-id.v1'] = PROJECT
    return encoded


def write_storage(path, values):
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
        db.executemany('INSERT INTO catalystLocalStorage (key,value) VALUES (?,?)', values.items())
        db.execute('PRAGMA user_version=1')


def ui_strings(xml):
    root = ET.fromstring(xml)
    return [value for node in root.iter('node') for key in ('text', 'content-desc')
            if (value := node.get(key, ''))]


def target_bounds(xml, label):
    root = ET.fromstring(xml)
    parents = {child: parent for parent in root.iter() for child in parent}
    nodes = list(root.iter('node'))
    exact = [node for node in nodes if label in (node.get('text'), node.get('content-desc'))]
    candidates = exact or [node for node in nodes if any(label in node.get(key, '') for key in ('text', 'content-desc'))]
    for node in candidates:
        if node.get('enabled') == 'false':
            continue
        ancestor = node
        while ancestor.get('clickable') != 'true' and ancestor in parents:
            ancestor = parents[ancestor]
        if ancestor.tag == 'node' and ancestor.get('enabled') != 'false':
            node = ancestor
        bounds = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
        if bounds:
            x1, y1, x2, y2 = map(int, bounds.groups())
            if x2 > x1 and y2 > y1:
                return ((x1+x2)//2, (y1+y2)//2)
    raise RuntimeError(f'Enabled UI control not found: {label}')


class Device:
    def __init__(self, serial=None):
        self.prefix = ['adb'] + (['-s', serial] if serial else [])

    def run(self, *args, binary=False, check=True, data=None, timeout=120):
        result = subprocess.run([*self.prefix, *map(str, args)], input=data,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        if check and result.returncode:
            raise RuntimeError(f'adb {args}: {result.stderr.decode(errors="replace")}')
        return result.stdout if binary else result.stdout.decode(errors='replace')

    def shell(self, *args, **kwargs):
        return self.run('shell', shlex.join(list(map(str, args))), **kwargs)

    def dump(self):
        self.shell('uiautomator', 'dump', '--compressed', '/sdcard/body-frame-qa.xml', timeout=30)
        raw = self.run('exec-out', 'cat', '/sdcard/body-frame-qa.xml', timeout=15)
        return raw[raw.index('<'):]

    def open(self, route):
        self.shell('am', 'force-stop', PACKAGE)
        self.shell('am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                   '-d', 'bodyframe://' + route, '-p', PACKAGE)
        time.sleep(2)

    def ready(self, expected, seconds=45):
        deadline = time.monotonic()+seconds
        last = ''
        while time.monotonic() < deadline:
            try:
                last = self.dump()
                strings = ui_strings(last)
                fatal = ['Unmatched Route', 'Render Error', 'Unable to load script', 'Something went wrong']
                if any(marker in text for text in strings for marker in fatal):
                    raise RuntimeError('Native app displays a JavaScript/navigation error')
                if all(any(marker in text for text in strings) for marker in expected):
                    return last
            except (subprocess.TimeoutExpired, ET.ParseError, ValueError):
                pass
            time.sleep(2)
        raise RuntimeError(f'Expected UI did not appear: {expected}; visible={ui_strings(last) if last else []}')

    def tap(self, label):
        for attempt in range(5):
            try:
                x, y = target_bounds(self.dump(), label)
                self.shell('input', 'tap', x, y)
                time.sleep(1)
                return
            except RuntimeError:
                if attempt == 4:
                    raise
                # Find offscreen controls using the actual display, never fixed dp coordinates.
                size = self.shell('wm', 'size')
                w, h = map(int, re.findall(r'(\d+)x(\d+)', size)[-1])
                self.shell('input', 'swipe', w//2, int(h*.72), w//2, int(h*.37), 350)
                time.sleep(.5)

    def seed(self, populated):
        self.shell('am', 'force-stop', PACKAGE)
        app_dir = self.shell('run-as', PACKAGE, 'pwd').strip()
        if not re.fullmatch(r'/data/(?:user/\d+|data)/com\.haebi\.photoguide', app_dir):
            raise RuntimeError(f'Unexpected app-private directory: {app_dir}')
        self.shell('run-as', PACKAGE, 'mkdir', '-p', 'databases', f'files/photos/{PROJECT}', f'files/photo-previews/{PROJECT}')
        if populated:
            for index in range(1, 4):
                for folder, fixture in [('photos', 'travelframe-debug-photo.jpg'), ('photo-previews', 'travelframe-debug-preview.jpg')]:
                    source = ROOT / 'debug-camera' / fixture
                    if source.read_bytes()[:2] != b'\xff\xd8':
                        raise RuntimeError(f'Missing valid repository JPEG fixture: {source}')
                    relative = f'files/{folder}/{PROJECT}/photo-qa-demo-photo-{index}.jpg'
                    self.shell('run-as', PACKAGE, 'sh', '-c', f'cat > {relative}', data=source.read_bytes())
        with tempfile.TemporaryDirectory() as temporary:
            db = Path(temporary) / 'RKStorage'
            write_storage(db, fixture_values(app_dir, populated))
            self.shell('run-as', PACKAGE, 'rm', '-f', 'databases/RKStorage-wal', 'databases/RKStorage-shm', 'databases/RKStorage-journal')
            self.shell('run-as', PACKAGE, 'sh', '-c', 'cat > databases/RKStorage', data=db.read_bytes())
        return app_dir


def capture(device, directory, name, route, expected, action=None):
    record = dict(profile=directory.name, screen=name, route=route, expected=expected, startedAt=datetime.now(timezone.utc).isoformat())
    try:
        device.open(route)
        if action:
            device.ready(action[0])
            device.tap(action[1])
        xml = device.ready(expected)
        foreground = device.shell('dumpsys', 'activity', 'activities')
        resumed = '\n'.join(line for line in foreground.splitlines() if 'ResumedActivity' in line or 'topResumedActivity' in line)
        if PACKAGE not in resumed:
            raise RuntimeError(f'App is not foreground: {resumed}')
        image = device.run('exec-out', 'screencap', '-p', binary=True)
        if image[:8] != b'\x89PNG\r\n\x1a\n':
            raise RuntimeError('Native screencap did not produce a PNG')
        width, height = struct.unpack('>II', image[16:24])
        (directory / f'{name}.png').write_bytes(image)
        (directory / f'{name}.xml').write_text(xml)
        record.update(status='captured', width=width, height=height,
                      sha256=hashlib.sha256(image).hexdigest(), visibleText=ui_strings(xml), foreground=resumed)
    except Exception as error:
        record.update(status='failed', error=str(error))
        try:
            (directory / f'{name}.failure.png').write_bytes(device.run('exec-out', 'screencap', '-p', binary=True))
            (directory / f'{name}.failure.xml').write_text(device.dump())
        except Exception as diagnostics_error:
            record['diagnosticsError'] = str(diagnostics_error)
    (directory / f'{name}.json').write_text(json.dumps(record, indent=2, ensure_ascii=False))
    print(f"{directory.name}/{name}: {record['status']}", flush=True)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--serial')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    device = Device(args.serial)
    records = []
    manifest = dict(package=PACKAGE, apkSha256=hashlib.sha256(args.apk.read_bytes()).hexdigest(),
                    fixture='repository debug-camera JPEGs copied to synthetic guest records',
                    network='emulator Wi-Fi and mobile data disabled; no authentication configured',
                    limits=['No signed-in/cloud/billing operations', 'No actual Health Connect import',
                            'Video library empty state; no video export is performed'], captures=records)
    try:
        if device.shell('getprop', 'ro.kernel.qemu').strip() != '1':
            raise RuntimeError('Refusing to seed a physical Android device')
        device.run('install', '-r', '-g', args.apk.resolve())
        device.shell('svc', 'wifi', 'disable')
        device.shell('svc', 'data', 'disable')
        device.shell('input', 'keyevent', 'KEYCODE_WAKEUP')
        device.shell('wm', 'dismiss-keyguard')
        for profile, size, density in PROFILES:
            device.shell('am', 'force-stop', PACKAGE)
            device.shell('wm', 'size', size)
            device.shell('wm', 'density', density)
            time.sleep(3)
            directory = args.output / profile
            directory.mkdir(exist_ok=True)
            device.seed(False)
            record = capture(device, directory, 'create-project', 'studio', ['프로젝트 이름', '목표 기록 수'],
                             (['프로젝트별 몸의 변화를'], '새 프로젝트 만들기'))
            record['profile'] = profile
            records.append(record)
            device.seed(True)
            screens = [
                ('camera', 'camera', ['프로젝트 선택', '사진 촬영'], None),
                ('records', 'studio', ['QA 데모', '프로젝트별 몸의 변화를'], None),
                ('project', f'project/{PROJECT}', ['QA 데모', '프로젝트 설정 열기'], None),
                ('project-settings', f'project/{PROJECT}', ['프로젝트 설정', '변경 저장', '이름'], (['프로젝트 설정 열기'], '프로젝트 설정 열기')),
                ('project-reminder', f'project/{PROJECT}', ['촬영 알림', '요일'], (['프로젝트 촬영 알림 설정'], '프로젝트 촬영 알림 설정')),
                ('photo', f'photo/{PHOTO}', ['기록 상세'], None),
                ('photo-measurement', f'photo/{PHOTO}?measurement=1', ['몸무게', '체지방률', '저장'], None),
                ('edit', 'edit?' + urlencode({'photoId': PHOTO}), ['사진 편집', '빠른 편집'], None),
                ('compare', f'project/{PROJECT}/compare', ['전후 사진 비교', '첫 사진', '마지막 사진'], None),
                ('measurements', f'project/{PROJECT}/measurements', ['수치 기록', 'QA 데모'], None),
                ('measurement-create', f'project/{PROJECT}/measurements?add=1', ['몸무게', '저장'], None),
                ('video', 'trip-clip', ['프로젝트로 변화 영상을'], None),
                ('video-create', 'video-create', ['변화 영상 만들기', 'QA 데모'], None),
                ('video-photos', 'video-create', ['사진 선택', '전체 선택'], (['변화 영상 만들기'], '사진 수')),
                ('video-interval', 'video-create', ['사진 간격', '적용'], (['변화 영상 만들기'], '사진 간격')),
                ('video-quality', 'video-create', ['영상 화질', '적용'], (['변화 영상 만들기'], '화질')),
                ('video-ratio', 'video-create', ['화면 비율', '적용'], (['변화 영상 만들기'], '화면 비율')),
                ('video-overlay', 'video-create', ['텍스트 오버레이', '적용'], (['변화 영상 만들기'], '텍스트')),
                ('video-library', 'video-library', ['영상 관리', '저장한 영상'], None),
                ('settings', 'settings', ['설정', '기준 사진 표시'], None),
                ('settings-reference', 'settings', ['기준 사진 표시', '닫기'], (['기준 사진 표시'], '기준 사진 표시')),
                ('account', 'account', ['로그인하고 기록을 보호하세요.'], None),
                ('capture-preview', 'capture-preview?' + urlencode({'id': PHOTO}), ['촬영 미리보기', '다시 촬영'], None),
            ]
            for name, route, expected, action in screens:
                record = capture(device, directory, name, route, expected, action)
                record['profile'] = profile
                records.append(record)
            (directory / 'device.txt').write_text(device.shell('wm', 'size') + device.shell('wm', 'density') + device.shell('getprop', 'ro.build.version.sdk'))
    except Exception as error:
        manifest['fatalError'] = str(error)
        raise
    finally:
        manifest['captured'] = sum(item.get('status') == 'captured' for item in records)
        manifest['failed'] = sum(item.get('status') != 'captured' for item in records)
        (args.output / 'capture-manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
        (args.output / 'logcat.txt').write_text(device.run('logcat', '-d', check=False))
        device.shell('am', 'force-stop', PACKAGE, check=False)
        device.shell('wm', 'size', 'reset', check=False)
        device.shell('wm', 'density', 'reset', check=False)
    if manifest['failed']:
        raise SystemExit(f"{manifest['failed']} requested native captures failed; inspect capture-manifest.json and failure screenshots")


if __name__ == '__main__':
    main()
