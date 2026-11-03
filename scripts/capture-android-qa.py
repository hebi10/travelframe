#!/usr/bin/env python3
"""Native APK screenshots on a disposable emulator, with local-only guest fixtures.

Never run against a physical device or an existing user's installation. This
script verifies qemu, then replaces only this package's emulator RKStorage DB.
No app QA route, production credentials, login, purchase or cloud call is used.
"""
import argparse
from datetime import datetime, timezone
import hashlib
from functools import lru_cache
import os
import select
import json
from pathlib import Path
import re
import shlex
import shutil
import sqlite3
import struct
import subprocess
import tempfile
import time
from urllib.parse import urlencode, unquote, urlparse
import xml.etree.ElementTree as ET

PACKAGE = 'com.haebi.photoguide'
PROJECT = 'qa-demo-project'
PHOTO = 'qa-demo-photo-1'
ROOT = Path(__file__).resolve().parents[1]
PROFILES = [('mobile', '720x1600', 320), ('tablet', '1200x1920', 240)]



MARKER_LEVELS = {1: 40, 2: 120, 3: 210}
DIGITS = {1: ['00100','01100','00100','00100','00100','00100','01110'],
          2: ['01110','10001','00001','00010','00100','01000','11111'],
          3: ['11110','00001','00001','01110','00001','00001','11110']}


def pattern_rgb(index, width=720, height=960):
    """Deterministic PPM pixels: broad measurable gray field plus a large1/2/3."""
    level = MARKER_LEVELS[index]
    pixels = bytearray([level]) * (width*height*3)
    ink = 245 if level < 150 else 15
    def rectangle(x1, y1, x2, y2):
        row = bytes([ink]) * ((x2-x1)*3)
        for y in range(y1, y2):
            offset = (y*width+x1)*3
            pixels[offset:offset+len(row)] = row
    scale = max(1, min(width//9, height//11))
    left, top = (width-5*scale)//2, (height-7*scale)//2
    for y, row in enumerate(DIGITS[index]):
        for x, value in enumerate(row):
            if value == '1': rectangle(left+x*scale, top+y*scale, left+(x+1)*scale, top+(y+1)*scale)
    return bytes(pixels)


@lru_cache(maxsize=6)
def fixture_jpeg(index, preview=False):
    width, height = (360,480) if preview else (720,960)
    ppm = f'P6\n{width} {height}\n255\n'.encode()+pattern_rgb(index,width,height)
    return subprocess.run(['ffmpeg','-v','error','-f','image2pipe','-vcodec','ppm','-i','pipe:0',
        '-frames:v','1','-threads','1','-q:v','2','-f','mjpeg','pipe:1'], input=ppm,
        capture_output=True, check=True, timeout=30).stdout


def validate_marker_pixels(pixels, width, height, index):
    if len(pixels) != width*height*3: raise ValueError('Decoded RGB frame has an invalid size')
    samples = []
    for nx, ny in [(0.12,0.12),(0.88,0.12),(0.12,0.88),(0.88,0.88)]:
        x,y = int(width*nx),int(height*ny)
        offset=(y*width+x)*3
        channels=list(pixels[offset:offset+3])
        if max(channels)-min(channels)>15: raise ValueError('Native frame marker is not the expected monochrome field')
        samples.append(sum(channels)/3)
    expected=MARKER_LEVELS[index]
    if any(abs(value-expected)>18 for value in samples):
        raise ValueError(f'Blank, stale or wrong photo pixels: photo{index} expected{expected}, got{samples}')
    return dict(photo=index, expectedLuminance=expected, measuredLuminance=samples)


def inspect_native_frames(path, directory):
    evidence=[]
    for index, frame in enumerate([0,3,6],1):
        data=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-vf',f'select=eq(n\\,{frame})',
            '-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],capture_output=True,check=True,timeout=30).stdout
        item=validate_marker_pixels(data,1080,1440,index)
        item['frame']=frame
        evidence.append(item)
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-vf',f'select=eq(n\\,{frame})',
            '-frames:v','1',str(directory/f'native-video-photo-{index}-frame-{frame}.png')],capture_output=True,check=True,timeout=30)
    return evidence


def fixture_values(app_dir, populated=True, font_size='medium'):
    """Mirror the versioned schemas in lib/*-library.ts; all values are synthetic."""
    photos = []
    measurements = []
    dates = ['2026-10-01T09:00:00.000Z', '2026-10-15T09:00:00.000Z', '2026-11-01T09:00:00.000Z']
    for index, date in enumerate(dates, 1):
        photo_id = f'qa-demo-photo-{index}'
        uri = f'file://{app_dir}/files/photos/{PROJECT}/photo-{photo_id}.jpg'
        preview = f'file://{app_dir}/files/photo-previews/{PROJECT}/photo-{photo_id}.jpg'
        photos.append(dict(id=photo_id, uri=uri, previewUri=preview, createdAt=date,
                           width=720, height=960, ratioLabel='Original', kind='original',
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
        'travel-frame.guide-progress.v1': dict(seenGuideVersion=4, seenIntro=True,
            seenTabs={tab: True for tab in ['camera', 'studio', 'tripClip', 'account', 'settings']}),
        'travel-frame.settings.v1': dict(storageMode='local_only', cloudBackupEnabled=False,
            themeMode='dark', cameraFacing='back', referencePhotoVisible=True, fontSize=font_size),
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


class ControlOutsideViewport(RuntimeError):
    def __init__(self,label,direction):
        super().__init__(f'Actionable control is outside the usable viewport: {label}')
        self.direction=direction


def target_bounds(xml, label, match='exact', viewport=None):
    """Select an actual enabled action. Headings never substitute for controls."""
    if match not in {'exact','summary'}: raise ValueError('Unsupported explicit selector match mode')
    root=ET.fromstring(xml)
    parents={child:parent for parent in root.iter() for child in parent}
    candidates=[]
    for node in root.iter('node'):
        values=[node.get('text',''),node.get('content-desc','')]
        if any(value==label or (match=='summary' and value.startswith(label+', ')) for value in values):
            candidates.append(node)
    outside=None
    for node in candidates:
        ancestor=node
        disabled=False
        while ancestor.tag=='node':
            if ancestor.get('enabled')=='false': disabled=True;break
            if ancestor.get('clickable')=='true':break
            ancestor=parents.get(ancestor,root)
            if ancestor is root:break
        if disabled or ancestor.tag!='node' or ancestor.get('clickable')!='true' or ancestor.get('enabled')!='true':continue
        bounds=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',ancestor.get('bounds',''))
        if not bounds:continue
        x1,y1,x2,y2=map(int,bounds.groups())
        if x2<=x1 or y2<=y1:continue
        if viewport:
            left,top,right,bottom=viewport
            if not (left<=x1<x2<=right and top<=y1<y2<=bottom):
                outside=ControlOutsideViewport(label,'up' if y1<top else 'down');continue
        return ((x1+x2)//2,(y1+y2)//2)
    if outside:raise outside
    raise RuntimeError(f'Exact enabled clickable control not found: {label}')


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

    def open(self, route, restart=True):
        if restart:
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

    def viewport(self):
        w,h=map(int,re.findall(r'(\d+)x(\d+)',self.shell('wm','size'))[-1])
        density=int(re.findall(r'\d+',self.shell('wm','density'))[-1])
        # Fixed Pixel2 API35 profile uses24dp status and48dp three-button bars.
        return (0,round(24*density/160),w,h-round(48*density/160))

    def find_control(self, label, match='exact'):
        viewport=self.viewport()
        for attempt in range(7):
            try:
                x, y = target_bounds(self.dump(), label,match=match,viewport=viewport)
                return x, y
            except RuntimeError as error:
                if attempt == 6:raise
                self.scroll_down(reverse=(error.direction=='up') if isinstance(error,ControlOutsideViewport) else attempt>=3)

    def scroll_down(self,reverse=False):
        root=ET.fromstring(self.dump())
        areas=[]
        for node in root.iter('node'):
            if node.get('scrollable')=='true' and node.get('package')==PACKAGE:
                coords=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
                if len(coords)==4 and coords[3]>coords[1]: areas.append(coords)
        if areas:
            x1,y1,x2,y2=max(areas,key=lambda b:(b[2]-b[0])*(b[3]-b[1]))
        else:
            w,h=map(int,re.findall(r'(\d+)x(\d+)',self.shell('wm','size'))[-1]);x1,y1,x2,y2=0,0,w,int(h*.65)
        x=(x1+x2)//2
        start=int(y1+(y2-y1)*.85);end=int(y1+(y2-y1)*.25)
        if reverse:start,end=end,start
        self.shell('input','swipe',x,start,x,end,350)
        time.sleep(.5)

    def storage(self):
        # Read a snapshot without stopping/restarting the app or changing its quota.
        for attempt in range(3):
            try:
                with tempfile.TemporaryDirectory() as temporary:
                    path=Path(temporary)/'RKStorage'
                    path.write_bytes(self.run('exec-out','run-as',PACKAGE,'cat','databases/RKStorage',binary=True))
                    for suffix in ('-wal','-shm'):
                        data=self.run('exec-out','run-as',PACKAGE,'cat','databases/RKStorage'+suffix,binary=True,check=False)
                        if data: Path(str(path)+suffix).write_bytes(data)
                    with sqlite3.connect(path) as db: return dict(db.execute('SELECT key,value FROM catalystLocalStorage'))
            except sqlite3.Error:
                if attempt==2: raise
                time.sleep(.3)

    def tap(self, label,match='exact'):
        x, y = self.find_control(label,match=match)
        self.shell('input', 'tap', x, y)
        time.sleep(1)

    def open_control(self,label,expected,match='exact'):
        """Retry one missed tap only while its actual modal postcondition is absent."""
        for attempt in range(2):
            current=self.dump()
            strings=ui_strings(current)
            if all(any(marker in text for text in strings) for marker in expected):return current
            self.tap(label,match=match)
            try:return self.ready(expected,seconds=10)
            except RuntimeError:
                # Recheck before retrying; an animation may have completed meanwhile.
                current=self.dump();strings=ui_strings(current)
                if all(any(marker in text for text in strings) for marker in expected):return current
                if attempt:raise
        raise RuntimeError('Control did not open its expected modal')

    def seed(self, populated, font_size='medium'):
        self.shell('am', 'force-stop', PACKAGE)
        app_dir = self.shell('run-as', PACKAGE, 'pwd').strip()
        if not re.fullmatch(r'/data/(?:user/\d+|data)/com\.haebi\.photoguide', app_dir):
            raise RuntimeError(f'Unexpected app-private directory: {app_dir}')
        self.shell('run-as', PACKAGE, 'mkdir', '-p', 'databases', f'files/photos/{PROJECT}', f'files/photo-previews/{PROJECT}')
        if populated:
            for index in range(1, 4):
                for folder in ['photos','photo-previews']:
                    relative = f'files/{folder}/{PROJECT}/photo-qa-demo-photo-{index}.jpg'
                    self.shell('run-as', PACKAGE, 'sh', '-c', f'cat > {relative}', data=fixture_jpeg(index,folder=='photo-previews'))
        with tempfile.TemporaryDirectory() as temporary:
            db = Path(temporary) / 'RKStorage'
            write_storage(db, fixture_values(app_dir, populated, font_size))
            self.shell('run-as', PACKAGE, 'rm', '-f', 'databases/RKStorage-wal', 'databases/RKStorage-shm', 'databases/RKStorage-journal')
            self.shell('run-as', PACKAGE, 'sh', '-c', 'cat > databases/RKStorage', data=db.read_bytes())
        return app_dir


def capture(device, directory, name, route, expected, action=None, open_route=True):
    record = dict(profile=directory.name, screen=name, route=route, expected=expected, startedAt=datetime.now(timezone.utc).isoformat())
    try:
        if open_route:
            device.open(route)
        if action:
            if callable(action):
                evidence=action(device)
                if evidence is not None: record['actionEvidence']=evidence
            else:
                device.ready(action[0])
                device.open_control(action[1],expected,match=action[2] if len(action)>2 else 'exact')
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



def creation_keyboard(device):
    device.ready(['프로젝트별 몸의 변화를'])
    device.tap('새 프로젝트 만들기')
    device.shell('settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1')
    xml = device.ready(['프로젝트 이름', '목표 기록 수'])
    for node in ET.fromstring(xml).iter('node'):
        if node.get('class') == 'android.widget.EditText':
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
            device.shell('input', 'tap', (x1+x2)//2, (y1+y2)//2)
            time.sleep(2)
            device.shell('input', 'text', 'QA_keyboard_large_font')
            state = device.shell('dumpsys', 'input_method')
            if not re.search(r'(?:mInputShown|isInputViewShown|mIsInputViewShown)=true', state):
                raise RuntimeError('Project input focus did not show the native keyboard')
            return
    raise RuntimeError('Project name input not found')


def onboarding_welcome(device):
    device.ready(['기준 사진 표시'])
    device.tap('사용 가이드',match='summary')
    device.ready(['바디 프레임에 오신 것을 환영합니다.'])
    device.find_control('시작하기')  # Scroll inside the real guide when large text pushes it below the fold.


def onboarding_scrolled(device):
    onboarding_welcome(device)
    device.tap('시작하기')
    device.ready(['프로젝트로 기록을 나눕니다'])
    device.find_control('다음')  # Verify the footer is reachable without advancing the step.


def private_video_path(uri, app_dir):
    parsed = urlparse(uri)
    if parsed.scheme != 'file' or parsed.netloc:
        raise ValueError('Exported video must be an app-private local file')
    path = unquote(parsed.path)
    prefix = app_dir.rstrip('/') + '/files/made-videos/'
    if not path.startswith(prefix):
        raise ValueError('Exported video is outside the disposable app video directory')
    name = path[len(prefix):]
    if not re.fullmatch(r'[A-Za-z0-9_-]+\.mp4', name):
        raise ValueError('Unexpected exported video filename')
    return 'files/made-videos/' + name


def validate_video_probe(probe):
    stream = next((stream for stream in probe.get('streams', []) if stream.get('codec_type') == 'video'), None)
    if not stream or stream.get('codec_name') != 'h264':
        raise ValueError('Native recorder did not produce an H.264 video stream')
    if (stream.get('width'), stream.get('height')) != (1080, 1440):
        raise ValueError('Native video dimensions do not match default 1080p 3:4 output')
    duration = float(probe.get('format', {}).get('duration', 0))
    if abs(duration-0.3) > 1/30+0.0001:
        raise ValueError(f'Unexpected duration for three 0.1-second photos: {duration}')
    frames = stream.get('nb_read_frames')
    if frames in (None,'N/A') or int(frames) != 9:
        raise ValueError(f'Expected nine native frames, got {frames}')
    return dict(codec=stream['codec_name'], width=stream['width'], height=stream['height'],
                duration=duration, frames=frames)



def creation_submit(device):
    # Continue from the keyboard screenshot. No reseed/restart before submission.
    device.tap('프로젝트 만들기')
    device.ready(['QA_keyboard_large_font'])
    projects=json.loads(device.storage().get('body-frame.projects.v1','[]'))
    if len(projects)!=1 or 'QA_keyboard_large_font' not in projects[0].get('name',''):
        raise RuntimeError('Large-font keyboard form did not persist the newly created project')
    return dict(projectPersisted=True,project=projects[0])


def no_export_side_effects(before, after):
    for key in ['travel-frame.videos.v1','guestWeeklyVideoExportUsage']:
        if before.get(key)!=after.get(key):
            raise ValueError(f'Failed/cancelled export changed persisted video/quota state: {key}')
    return dict(videosUnchanged=True, guestQuotaUnchanged=True)


def wait_export_terminal(device, expected_error=None, seconds=180):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        xml=device.dump();strings=ui_strings(xml)
        running=any('영상 만드는 중' in value for value in strings)
        button=any(value.strip()=='영상 만들기' for value in strings)
        if not running and button:
            if expected_error and not any(any(marker in value for marker in expected_error) for value in strings):
                raise RuntimeError(f'Export stopped without the expected real error: {strings}')
            return strings
        time.sleep(1)
    raise RuntimeError('Native export/encoder did not settle within180seconds')


def set_interval(device, value):
    device.tap('사진 간격',match='summary');device.ready(['사진 간격','적용'])
    device.tap(f'{value}초');device.tap('적용')
    device.ready([f'사진 간격, {value}초'])


def background_during_native_encoder(device, directory):
    """Observe a real encoder start before HOME; absence of evidence is a failure."""
    pid=device.shell('pidof',PACKAGE).strip()
    if not re.fullmatch(r'\d+',pid): raise RuntimeError('Cannot identify the running app process')
    x,y=device.find_control('영상 만들기')
    monitor=subprocess.Popen([*device.prefix,'logcat','-v','brief','-T','1','--pid='+pid],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    evidence=bytearray();seen_encoder=False;observed=False
    start=time.monotonic()
    try:
        device.shell('input','tap',x,y)  # No fixed sleep: watch the actual MediaCodec state.
        while time.monotonic()-start<2.5:
            if select.select([monitor.stdout],[],[],.05)[0]:
                chunk=os.read(monitor.stdout.fileno(),65536)
                if not chunk: break
                evidence.extend(chunk)
                text=evidence.decode(errors='replace')
                seen_encoder=seen_encoder or bool(re.search(r'(?:CCodec|ACodec|MediaCodec).*encoder',text,re.I))
                if seen_encoder and re.search(r'(?:CCodec|ACodec|MediaCodec|CCodecBufferChannel).*?(?:start:|set\(RUNNING\)|Now Executing|state.*STARTING)',text,re.I):
                    observed=True
                    device.shell('input','keyevent','KEYCODE_HOME')
                    background_sent_after=time.monotonic()-start
                    break
        if not observed: raise RuntimeError('No active native encoder-start evidence before background deadline; cancellation case not proven')
        (directory/'video-background-home.png').write_bytes(device.run('exec-out','screencap','-p',binary=True))
        (directory/'video-background-home.xml').write_text(device.dump())
        # Resume the existing Activity without a deep-link remount that could discard
        # the cancelled screen's terminal message. The final retry may remount later.
        device.shell('am','start','-W','-a','android.intent.action.MAIN','-c','android.intent.category.LAUNCHER','-n',PACKAGE+'/.MainActivity')
        now=device.shell('pidof',PACKAGE).strip()
        if now!=pid: raise RuntimeError('Background recovery restarted the process instead of preserving the native guard')
        strings=wait_export_terminal(device,['영상 만들기가 취소되었습니다'])
        return dict(encoderStartObserved=True,backgroundWithinSeconds=round(background_sent_after,3),
                    pidBefore=pid,pidAfter=now,terminalText=strings)
    finally:
        monitor.terminate()
        try:
            remainder=monitor.communicate(timeout=3)[0]
            evidence.extend(remainder or b'')
        except subprocess.TimeoutExpired: monitor.kill();monitor.communicate()
        (directory/'video-background-codec-log.txt').write_bytes(evidence)


def video_failure_and_background_smoke(device, directory):
    records=[]
    relative=f'files/photos/{PROJECT}/photo-qa-demo-photo-2.jpg'
    device.open('video-create')
    device.ready(['변화 영상 만들기','QA 데모'])
    first_pid=device.shell('pidof',PACKAGE).strip()
    for case in ['missing-original','corrupt-original','background-cancel']:
        result=dict(profile=directory.name,screen='video-'+case,route='video-create',createClicks=0)
        before=device.storage()
        try:
            if case=='missing-original': device.shell('run-as',PACKAGE,'rm',relative)
            elif case=='corrupt-original': device.shell('run-as',PACKAGE,'sh','-c',f'cat > {relative}',data=b'not-a-jpeg-qa-corrupt-original')
            if case=='background-cancel':
                set_interval(device,'1')
                result.update(background_during_native_encoder(device,directory));result['createClicks']=1
            else:
                device.tap('영상 만들기');result['createClicks']=1
                markers=['사진 원본을 확인하지 못했습니다'] if case=='missing-original' else ['사진을 불러오지 못했습니다','사진 표시 시간이 초과되었습니다']
                result['terminalText']=wait_export_terminal(device,markers)
            records.append(capture(device,directory,'video-'+case+'-result','video-create',[],open_route=False))
            result.update(no_export_side_effects(before,device.storage()))
            if device.shell('pidof',PACKAGE).strip()!=first_pid:
                raise RuntimeError('Native failure/cancellation acceptance unexpectedly restarted the app process')
            result['status']='captured'
        except Exception as error:
            result.update(status='failed',error=str(error))
            records.append(capture(device,directory,'video-'+case+'-failure','video-create',[],open_route=False))
        finally:
            # Restore just the task-owned original file; never edit guest quota or RKStorage here.
            device.shell('run-as',PACKAGE,'sh','-c',f'cat > {relative}',data=fixture_jpeg(2))
        (directory/f'video-{case}.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
        records.append(result)
    # Real UI resets the next export to0.1 seconds; no force-stop/reseed/quota reset.
    try:
        set_interval(device,'0.1')
    except Exception as error:
        records.append(dict(profile=directory.name,screen='video-short-interval-reset',status='failed',error=str(error)))
    return records


def video_smoke(device, directory, restart=True):
    """Perform one real guest export; never retry/alter quota or call paid services."""
    records = []
    result = dict(profile=directory.name, screen='video-native-export', route='video-create',
                  expectedPhotos=3, expectedFrames=9, expectedDuration=0.3, createClicks=0)
    try:
        retry_pid=device.shell('pidof',PACKAGE).strip()
        result.update(retryWithoutForceStop=not restart,pidBeforeRetry=retry_pid)
        device.open('video-create',restart=restart)
        if not restart:
            for _ in range(3):device.scroll_down(reverse=True)
        device.ready(['변화 영상 만들기', 'QA 데모'])
        device.tap('영상 만들기')
        result['createClicks'] = 1
        started = time.monotonic()
        while time.monotonic()-started < 180:
            xml = device.dump()
            strings = ui_strings(xml)
            running = any('영상 만드는 중' in value for value in strings)
            if not running and time.monotonic()-started > 2 and any(value.strip() == '영상 만들기' for value in strings):
                break
            # Permission prompts are not bypassed. Their actual state is retained on timeout.
            time.sleep(2)
        else:
            raise RuntimeError('Native video export did not complete within180seconds')
        result['elapsedSeconds'] = round(time.monotonic()-started, 2)
        completion = capture(device, directory, 'video-export-completion', 'video-create', [], open_route=False)
        records.append(completion)
        strings = completion.get('visibleText', [])
        result['albumSaved'] = any('앨범에 저장했습니다.' in value for value in strings)
        result['appSavedMessage'] = any('영상은 앱에 저장했습니다.' in value for value in strings)
        result['completionText'] = strings
        result['pidAfterExport']=device.shell('pidof',PACKAGE).strip()
        if not restart and result['pidAfterExport']!=retry_pid:
            raise RuntimeError('Final retry changed process identity instead of proving same-process recovery')
        library = capture(device, directory, 'video-library-populated', 'video-library',
                          ['영상 관리', 'QA 데모'])
        records.append(library)
        device.shell('am', 'force-stop', PACKAGE)
        app_dir = device.shell('run-as', PACKAGE, 'pwd').strip()
        with tempfile.TemporaryDirectory() as temporary:
            db_path = Path(temporary) / 'RKStorage'
            db_path.write_bytes(device.run('exec-out', 'run-as', PACKAGE, 'cat', 'databases/RKStorage', binary=True))
            for suffix in ('-wal', '-shm'):
                data = device.run('exec-out', 'run-as', PACKAGE, 'cat', 'databases/RKStorage'+suffix, binary=True, check=False)
                if data:
                    Path(str(db_path)+suffix).write_bytes(data)
            with sqlite3.connect(db_path) as db:
                persisted=dict(db.execute('SELECT key,value FROM catalystLocalStorage'))
            videos=json.loads(persisted.get('travel-frame.videos.v1','[]'))
            quota=json.loads(persisted.get('guestWeeklyVideoExportUsage','{}'))
            if quota.get('count')!=1: raise RuntimeError('Final successful guest export did not consume exactly one quota unit')
            result['guestQuotaAfter']=quota
        if len(videos) != 1 or videos[0].get('photoIds') != [f'qa-demo-photo-{index}' for index in range(1, 4)]:
            raise RuntimeError('Native export did not persist exactly one video with all three fixture photo identities')
        video = videos[0]
        records.append(capture(device, directory, 'video-detail', 'video/' + video['id'], ['QA 데모']))
        device.shell('am', 'force-stop', PACKAGE)
        relative = private_video_path(video['uri'], app_dir)
        data = device.run('exec-out', 'run-as', PACKAGE, 'cat', relative, binary=True)
        if len(data) < 32 or b'ftyp' not in data[:32]:
            raise RuntimeError('Persisted export is not an MP4 file')
        path = directory / 'native-video-smoke.mp4'
        path.write_bytes(data)
        result.update(video=video, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        result['mediaStore'] = device.shell('content', 'query', '--uri', 'content://media/external/video/media',
                                            '--projection', '_id:_display_name:relative_path:duration:width:height', check=False)
        if shutil.which('ffprobe'):
            process = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(path)], capture_output=True, check=True, timeout=30)
            probe = json.loads(process.stdout)
            result['probe'] = validate_video_probe(probe)
            (directory / 'native-video-ffprobe.json').write_text(json.dumps(probe, indent=2))
        else:
            raise RuntimeError('ffprobe is required for native video timing/frame validation')
        if shutil.which('ffmpeg'):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-frames:v', '1', str(directory/'native-video-first-frame.png')], capture_output=True, check=True, timeout=30)
            result['firstFrameDecoded'] = True
            result['intervalPixelEvidence'] = inspect_native_frames(path,directory)
        if not result['albumSaved']:
            raise RuntimeError('Video persisted in the app, but native album completion was not confirmed')
        if any(item['status'] != 'captured' for item in records):
            raise RuntimeError('Video completion/library evidence failed')
        result['status'] = 'captured'
    except Exception as error:
        result.update(status='failed', error=str(error))
        records.append(capture(device, directory, 'video-export-result', 'video-create', [], open_route=False))
    (directory / 'video-native-export.json').write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"{directory.name}/video-native-export: {result['status']}", flush=True)
    records.append(result)
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--serial')
    parser.add_argument('--trust-manifest',type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    fixtures=args.output/'synthetic-fixtures';fixtures.mkdir(exist_ok=True)
    for index in (1,2,3):
        for preview in (False,True):
            (fixtures/f'card-{index}{"-preview" if preview else ""}.jpg').write_bytes(fixture_jpeg(index,preview))
    device = Device(args.serial)
    records = []
    manifest = dict(package=PACKAGE, apkSha256=hashlib.sha256(args.apk.read_bytes()).hexdigest(),
                    fixture='host-generated synthetic monochrome numbered cards1/2/3; no user images',
                    network='emulator Wi-Fi and mobile data disabled; no authentication configured',
                    limits=['No signed-in/cloud/billing operations', 'No actual Health Connect import',
                            'Photo editor requires login: guest capture shows the real login-required alert'], captures=records)
    if args.trust_manifest:
        manifest['apkTrust']=json.loads(args.trust_manifest.read_text())
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
            device.seed(False, 'large')
            device.shell('settings', 'put', 'system', 'font_scale', '1.3')
            records.append(capture(device, directory, 'create-project-large-font-keyboard', 'studio',
                                   ['프로젝트 이름'], creation_keyboard))
            records.append(capture(device,directory,'create-project-large-font-submitted','studio',
                                   ['QA_keyboard_large_font'],creation_submit,open_route=False))
            device.shell('settings', 'put', 'system', 'font_scale', '1.0')
            device.seed(True)
            screens = [
                ('camera', 'camera', ['프로젝트 선택', '사진 촬영'], None),
                ('records', 'studio', ['QA 데모', '프로젝트별 몸의 변화를'], None),
                ('project', f'project/{PROJECT}', ['QA 데모', '프로젝트 설정 열기'], None),
                ('project-settings', f'project/{PROJECT}', ['프로젝트 설정', '변경 저장', '이름'], (['프로젝트 설정 열기'], '프로젝트 설정 열기')),
                ('project-reminder', f'project/{PROJECT}', ['촬영 알림 설정 닫기', '촬영 알림', '요일'], (['프로젝트 촬영 알림 설정'], '프로젝트 촬영 알림 설정')),
                ('photo', f'photo/{PHOTO}', ['기록 상세'], None),
                ('photo-measurement', f'photo/{PHOTO}?measurement=1', ['몸무게', '체지방률', '저장'], None),
                ('edit-login-required', 'edit?' + urlencode({'photoId': PHOTO}), ['로그인이 필요합니다', '사진 편집은 무료 로그인부터'], None),
                ('compare', f'project/{PROJECT}/compare', ['전후 사진 비교', '첫 사진', '마지막 사진'], None),
                ('measurements', f'project/{PROJECT}/measurements', ['수치 기록', 'QA 데모'], None),
                ('measurement-create', f'project/{PROJECT}/measurements?add=1', ['몸무게', '저장'], None),
                ('video', 'trip-clip', ['프로젝트로 변화 영상을'], None),
                ('video-create', 'video-create', ['변화 영상 만들기', 'QA 데모'], None),
                ('video-photos', 'video-create', ['사진 선택', '전체 선택'], (['변화 영상 만들기'], '사진 수','summary')),
                ('video-interval', 'video-create', ['사진 간격', '적용'], (['변화 영상 만들기'], '사진 간격','summary')),
                ('video-quality', 'video-create', ['영상 화질', '적용'], (['변화 영상 만들기'], '화질','summary')),
                ('video-ratio', 'video-create', ['화면 비율', '적용'], (['변화 영상 만들기'], '화면 비율','summary')),
                ('video-overlay', 'video-create', ['텍스트 오버레이', '적용'], (['변화 영상 만들기'], '텍스트','summary')),
                ('video-library', 'video-library', ['영상 관리', '저장한 영상'], None),
                ('settings', 'settings', ['설정', '기준 사진 표시'], None),
                ('settings-reference', 'settings', ['기준 사진 표시', '닫기'], (['기준 사진 표시'], '기준 사진 표시','summary')),
                ('account', 'account', ['로그인하고 기록을 보호하세요.'], None),
                ('capture-preview', 'capture-preview?' + urlencode({'id': PHOTO}), ['촬영 미리보기', '다시 촬영'], None),
            ]
            for name, route, expected, action in screens:
                record = capture(device, directory, name, route, expected, action)
                record['profile'] = profile
                records.append(record)
            device.seed(True, 'large')
            device.shell('settings', 'put', 'system', 'font_scale', '1.3')
            records.append(capture(device, directory, 'onboarding-welcome-large-font', 'settings',
                                   ['바디 프레임에 오신 것을 환영합니다.', '시작하기'], onboarding_welcome))
            records.append(capture(device, directory, 'onboarding-scroll-large-font', 'settings',
                                   ['다음', '스킵'], onboarding_scrolled))
            device.shell('settings', 'put', 'system', 'font_scale', '1.0')
            device.seed(True)
            records.extend(video_failure_and_background_smoke(device,directory))
            records.extend(video_smoke(device, directory,restart=False))
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
        device.shell('settings', 'put', 'system', 'font_scale', '1.0', check=False)
    if manifest['failed']:
        raise SystemExit(f"{manifest['failed']} requested native captures failed; inspect capture-manifest.json and failure screenshots")


if __name__ == '__main__':
    main()
