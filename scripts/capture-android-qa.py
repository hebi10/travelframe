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
import uuid
import zipfile
from urllib.parse import urlencode, unquote, urlparse
import xml.etree.ElementTree as ET

PACKAGE = 'com.haebi.photoguide'
PROJECT = 'qa-demo-project'
PHOTO = 'qa-demo-photo-1'
ROOT = Path(__file__).resolve().parents[1]
PROFILES = [('mobile', '720x1600', 320), ('tablet', '1200x1920', 240)]
DESIGN_PROFILES = [
    ('phone-360dp', '720x1600', 320),
    ('phone-412dp', '824x1832', 320),
    ('tablet-600dp', '900x1600', 240),
    ('tablet-750dp', '1125x1800', 240),
]
DESIGN_VARIANTS = [
    ('dark-100', 'dark', 'medium', 1.0),
    ('light-130', 'light', 'large', 1.3),
    ('dark-150', 'dark', 'large', 1.5),
]



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


def fixture_values(app_dir, populated=True, font_size='medium', theme_mode='dark', intro_seen=True):
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
        'travel-frame.guide-progress.v1': dict(seenGuideVersion=4, seenIntro=intro_seen,
            seenTabs={tab: True for tab in ['camera', 'studio', 'tripClip', 'account', 'settings']}),
        'travel-frame.settings.v1': dict(storageMode='local_only', cloudBackupEnabled=False,
            themeMode=theme_mode, cameraFacing='back', referencePhotoVisible=True, fontSize=font_size),
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



def usable_viewport(width,height,density,window_state):
    # Actual InsetsState is authoritative; gesture-navigation fallback matches
    # this Pixel2 API35 runner when a system build omits dumpable inset sources.
    top=round(24*density/160);bottom=height-round(24*density/160)
    for line in window_state.splitlines():
        if re.search(r'(?:mVisible|visible)=false',line):continue
        kind='status' if re.search(r'(?:mType|type)=statusBars',line) else 'nav' if re.search(r'(?:mType|type)=navigationBars',line) else None
        if not kind:continue
        match=re.search(r'(?:mFrame|frame)=\[(\d+),(\d+)\]\[(\d+),(\d+)\]',line)
        if not match:continue
        x1,y1,x2,y2=map(int,match.groups())
        if x1!=0 or x2!=width:continue
        if kind=='status' and y1==0 and 0<y2<height/4:top=y2
        if kind=='nav' and y2==height and height*.75<y1<height:bottom=y1
    return (0,top,width,bottom)


def option_sheet_evidence(xml,viewport,require_scroll=True):
    root=ET.fromstring(xml);buttons={}
    for label in ['취소','적용']:
        target_bounds(xml,label,viewport=viewport)
        for node in root.iter('node'):
            if node.get('clickable')=='true' and node.get('enabled')=='true' and label in (node.get('text'),node.get('content-desc')):
                values=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
                if len(values)==4 and viewport[0]<=values[0]<values[2]<=viewport[2] and viewport[1]<=values[1]<values[3]<=viewport[3]:
                    buttons[label]=values;break
        if label not in buttons:raise RuntimeError(f'Option footer lacks full positive visible bounds: {label}')
    scroll=any('ScrollView' in node.get('class','') or 'RecyclerView' in node.get('class','') for node in root.iter('node'))
    if require_scroll and not scroll:raise RuntimeError('Option content lacks its bounded native scroll container')
    return dict(footerFullyVisible=True,footerBounds=buttons,usableViewport=viewport,scrollContainerPresent=scroll)


def camera_header_evidence(xml):
    progress=hint=None
    for node in ET.fromstring(xml).iter('node'):
        text=node.get('text','');bounds=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
        if len(bounds)!=4:continue
        if re.search(r'\d+\s*/\s*\d+\s*·.*초',text):progress=bounds
        if re.search(r'오늘\s+\d+번째 기록',text):hint=bounds
    if not progress or not hint:raise RuntimeError('Camera project progress/hint bounds are unavailable')
    if hint[1]<progress[3]:raise RuntimeError(f'Camera hint overlaps project progress: {progress}, {hint}')
    return dict(disjoint=True,progressBounds=progress,hintBounds=hint)


def fresh_muxer_evidence(logs,app_pid,marker):
    """Accept fresh ordered events, even when a mounted recorder reuses its ID."""
    active=False;encoder=False;ready={};muxers={};settled=set()
    line_pattern=re.compile(r'^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+(\d+)\s+\d+\s+[VDIWEF]\s+([^:]+):\s*(.*)$')
    for line in logs.splitlines():
        match=line_pattern.match(line)
        if not match:continue
        pid,tag,message=match.groups();tag=tag.strip()
        if tag=='BodyFrameQA' and message==marker:
            active=True;encoder=False;ready={};muxers={};settled=set();continue
        if not active or int(pid)!=int(app_pid):continue
        if re.search(r'(?:CCodec|ACodec|MediaCodec)',tag) and re.search(r'encoder',message,re.I):encoder=True
        begin=re.search(r'Session (vr_[A-Za-z0-9_-]+) ready',message)
        if tag=='ViewRecorder' and begin and encoder:ready[begin[1]]=line
        output=re.search(r'Muxer started for session (vr_[A-Za-z0-9_-]+)',message)
        if tag=='ViewRecorder' and output and output[1] in ready:muxers[output[1]]=line
        finish=re.search(r'(?:Finishing session |Session )(vr_[A-Za-z0-9_-]+)(?:.*(?:frames|cancelled|complete|failed))',message)
        if tag=='ViewRecorder' and finish:settled.add(finish[1])
    for session,line in muxers.items():
        if session not in settled:return dict(session=session,readyLine=ready[session],muxerLine=line,marker=marker,appPid=int(app_pid))
    return None



def build_native_hierarchy(output,android_sdk=None):
    """Build only the disposable shell QA driver, never the application APK."""
    source=ROOT/'tests/android-qa/BodyFrameQaHierarchy.java'
    sdk=Path(android_sdk or os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or '')
    preferred=sdk/'platforms/android-35/android.jar'
    jars=[path for path in (sdk/'platforms').glob('android-*/android.jar') if re.fullmatch(r'android-\d+',path.parent.name)]
    if not preferred.exists() and not jars:raise RuntimeError('Native QA hierarchy requires SDK35 or an installed numeric Android platform')
    android_jar=preferred if preferred.exists() else max(jars,key=lambda path:int(path.parent.name.split('-')[1]))
    dexers=[path for path in (sdk/'build-tools').glob('*/d8') if re.fullmatch(r'\d+(?:\.\d+)*',path.parent.name)]
    if not dexers:raise RuntimeError('Native QA hierarchy requires an installed stable Android build-tools D8')
    d8=max(dexers,key=lambda path:tuple(map(int,path.parent.name.split('.'))))
    classes=output/'classes';dex=output/'dex';classes.mkdir(parents=True,exist_ok=True);dex.mkdir(exist_ok=True)
    log=[]
    commands=[['javac','-source','8','-target','8','-encoding','UTF-8','-cp',str(android_jar),'-d',str(classes),str(source)]]
    try:
        for command in commands:
            run=subprocess.run(command,capture_output=True,text=True,timeout=60)
            log.extend(['$ '+shlex.join(command),run.stdout,run.stderr])
            if run.returncode:raise RuntimeError('Native hierarchy javac failed: '+run.stderr[-3000:])
        command=[str(d8),'--min-api','26','--lib',str(android_jar),'--output',str(dex),*[str(path) for path in classes.rglob('*.class')]]
        run=subprocess.run(command,capture_output=True,text=True,timeout=60);log.extend(['$ '+shlex.join(command),run.stdout,run.stderr])
        if run.returncode:raise RuntimeError('Native hierarchy D8 failed: '+run.stderr[-3000:])
        jar=output/'body-frame-qa-hierarchy.jar'
        with zipfile.ZipFile(jar,'w',compression=zipfile.ZIP_STORED) as archive:
            for path in dex.glob('*.dex'):archive.write(path,path.name)
        metadata=dict(backend='native-no-idle',source=str(source.relative_to(ROOT)),sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                      jarSha256=hashlib.sha256(jar.read_bytes()).hexdigest(),androidPlatform=android_jar.parent.name,d8Version=d8.parent.name)
        (output/'build-metadata.json').write_text(json.dumps(metadata,indent=2))
        return jar,metadata
    finally:(output/'hierarchy-build.log').write_text('\n'.join(log))


def prepare_native_hierarchy(device,output):
    jar,metadata=build_native_hierarchy(output/'host-tools/hierarchy')
    remote='/data/local/tmp/body-frame-qa-hierarchy-'+metadata['jarSha256'][:16]+'.jar'
    device.run('push',str(jar),remote)
    device.shell('chmod','0444',remote)
    device.native_hierarchy_jar=remote
    return metadata


class Device:
    def __init__(self, serial=None):
        self.prefix = ['adb'] + (['-s', serial] if serial else [])
        self.native_hierarchy_jar=None
        self.command_stderr=''
        self.hierarchy_sequence=0

    def run(self, *args, binary=False, check=True, data=None, timeout=120):
        result = subprocess.run([*self.prefix, *map(str, args)], input=data,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        self.command_stderr=result.stderr.decode(errors='replace')
        if check and result.returncode:
            raise RuntimeError(f'adb {args}: {result.stderr.decode(errors="replace")}')
        return result.stdout if binary else result.stdout.decode(errors='replace')

    def shell(self, *args, **kwargs):
        return self.run('shell', shlex.join(list(map(str, args))), **kwargs)

    def retain_preclick(self,target,attributes,required):
        remote=target+'.preclick.png'
        if required and attributes.get('preclick-screenshot-path')!=remote:
            raise RuntimeError('Native preclick PNG path does not match this action')
        image=self.run('exec-out','cat',remote,binary=True,check=required,timeout=10)
        if not image and not required:return None
        if not isinstance(image,bytes) or len(image)<33 or image[:8]!=b'\x89PNG\r\n\x1a\n' or image[12:16]!=b'IHDR':
            raise RuntimeError('Native preclick evidence is not a valid PNG header')
        width,height=struct.unpack('>II',image[16:24])
        if width<=0 or height<=0:raise RuntimeError('Native preclick PNG has invalid dimensions')
        policy=attributes.get('activation-policy')
        if required and policy not in ('strict-full-visible','native-semantic-after-show'):
            raise RuntimeError('Native preclick evidence lacks an explicit activation policy')
        captured_at=int(attributes.get('preclick-screenshot-at-ms','0'))
        if required and captured_at<=0:raise RuntimeError('Native preclick PNG capture timestamp is absent')
        record=dict(remotePath=remote,sha256=hashlib.sha256(image).hexdigest(),width=width,height=height,
                    capturedAtMs=captured_at,activationPolicy=policy,requiresVisualReview=True,
                    policyTrace={key:value for key,value in attributes.items() if key in (
                        'activation-policy','ancestor-clip-conflict','semantic-eligible-candidate-count',
                        'fully-visible-candidate-count','candidate-details','click-target-bounds',
                        'click-window-bounds','click-window-package','show-on-screen-action-count',
                        'show-on-screen-result','click-action-count')})
        directory=getattr(self,'capture_directory',None)
        if directory:
            folder=Path(directory)/'diagnostics/hierarchy-dumps';folder.mkdir(parents=True,exist_ok=True)
            path=folder/f'action-{self.hierarchy_sequence:04}.preclick.png';path.write_bytes(image)
            record['png']=str(path.relative_to(directory))
        return record

    def dump(self,click_label=None):
        self.hierarchy_sequence+=1
        target='/data/local/tmp/body-frame-qa-'+uuid.uuid4().hex+'.xml'
        backend='native-no-idle' if self.native_hierarchy_jar else 'legacy-uiautomator'
        evidence=dict(sequence=self.hierarchy_sequence,backend=backend,remotePath=target,startedAt=datetime.now(timezone.utc).isoformat(),requestedClickLabel=click_label,acknowledged=False)
        unacknowledged_xml=None
        try:
            self.shell('rm','-f',target)
            if self.native_hierarchy_jar:
                extra=['--click-label',click_label] if click_label is not None else []
                output=self.shell('env','CLASSPATH='+self.native_hierarchy_jar,'app_process','/system/bin','BodyFrameQaHierarchy',target,*extra,timeout=30)
                accepted=[('BODY_FRAME_QA_HIERARCHY_CLICKED ' if click_label is not None else 'BODY_FRAME_QA_HIERARCHY_DUMPED ')+target]
            else:
                if click_label is not None:raise RuntimeError('Semantic activation requires the prepared native hierarchy helper')
                output=self.shell('uiautomator','dump','--compressed',target,timeout=30)
                accepted=['UI hierchary dumped to: '+target,'UI hierarchy dumped to: '+target]
            evidence.update(stdout=output,stderr=self.command_stderr)
            if not any(ack in output.splitlines() for ack in accepted):
                raise RuntimeError('Hierarchy command did not acknowledge a newly written XML file: '+output+' '+self.command_stderr)
            raw=self.run('exec-out','cat',target,timeout=15)
            xml=raw[raw.index('<'):];root=ET.fromstring(xml)
            if root.tag!='hierarchy':raise RuntimeError('Fresh hierarchy output has an unexpected root')
            if click_label is not None and (root.get('action')!='accessibility-click' or root.get('requested-click-label')!=click_label):
                raise RuntimeError('Native action acknowledgement lacks matching preaction label evidence')
            evidence.update(acknowledged=True,xmlSha256=hashlib.sha256(xml.encode()).hexdigest(),completedAt=datetime.now(timezone.utc).isoformat(),rootAttributes=root.attrib)
            if click_label is not None:
                click_count=int(root.get('click-action-count','-1'))
                if click_count!=1:raise RuntimeError('Native click acknowledgement must record exactly one click action')
                show_count=int(root.get('show-on-screen-action-count','0'))
                if show_count not in (0,1):raise RuntimeError('Native show-on-screen action exceeded its one-action bound')
                evidence.update(nativeActionCount=click_count,nativeClickActionCount=click_count,nativeShowOnScreenActionCount=show_count)
                evidence['preclickScreenshot']=self.retain_preclick(target,root.attrib,required=True)
            self.last_hierarchy_evidence=evidence
            return xml
        except Exception as error:
            evidence.update(error=str(error),stderr=self.command_stderr,acknowledged=False)
            if click_label is not None:
                try:
                    raw=self.run('exec-out','cat',target,check=False,timeout=5)
                    if raw.strip():
                        unacknowledged_xml=raw
                        evidence['unacknowledgedXmlSha256']=hashlib.sha256(raw.encode()).hexdigest()
                        try:evidence['unacknowledgedRootAttributes']=ET.fromstring(raw).attrib
                        except ET.ParseError as parse_error:evidence['unacknowledgedXmlParseError']=str(parse_error)
                except Exception as diagnostic_error:evidence['unacknowledgedXmlReadError']=str(diagnostic_error)
                try:
                    screenshot=self.retain_preclick(target,evidence.get('unacknowledgedRootAttributes',{}),required=False)
                    if screenshot:evidence['unacknowledgedPreclickScreenshot']=screenshot
                except Exception as diagnostic_error:evidence['unacknowledgedPreclickReadError']=str(diagnostic_error)
            raise
        finally:
            directory=getattr(self,'capture_directory',None)
            folder=Path(directory)/'diagnostics/hierarchy-dumps' if directory else None
            if folder:folder.mkdir(parents=True,exist_ok=True)
            archive_error=None
            if click_label is not None:
                evidence['acquisitionSnapshots']=[]
                try:
                    listing=self.shell('find','/data/local/tmp','-maxdepth','1','-type','f','-name',Path(target).name+'.attempt-*.xml',timeout=5)
                    paths=sorted((path for path in listing.splitlines() if re.fullmatch(re.escape(target)+r'\.attempt-\d+\.xml',path)),key=lambda path:int(re.search(r'\.attempt-(\d+)\.xml$',path)[1]))
                    for remote in paths:
                        item=dict(remotePath=remote)
                        try:
                            content=self.run('exec-out','cat',remote,timeout=5)
                            item['sha256']=hashlib.sha256(content.encode()).hexdigest()
                            try:item['rootAttributes']=ET.fromstring(content).attrib
                            except ET.ParseError as parse_error:item['parseError']=str(parse_error)
                            if folder:
                                attempt=re.search(r'\.attempt-(\d+)\.xml$',remote)[1]
                                local=folder/f'action-{self.hierarchy_sequence:04}-attempt-{int(attempt):03}.xml';local.write_text(content)
                                item['xml']=str(local.relative_to(directory))
                        finally:self.shell('rm','-f',remote,check=False,timeout=5)
                        evidence['acquisitionSnapshots'].append(item)
                except Exception as error:
                    evidence['acquisitionArchiveError']=str(error)
                    if 'error' not in evidence:archive_error=RuntimeError('Native acquisition snapshots could not be retained: '+str(error))
            try:self.shell('rm','-f',target,*([target+'.preclick.png'] if click_label is not None else []),check=False,timeout=5)
            finally:
                if folder:
                    if click_label is not None and evidence.get('acknowledged'):
                        action_path=folder/f'action-{self.hierarchy_sequence:04}.xml';action_path.write_text(xml)
                        evidence['preactionXml']=str(action_path.relative_to(directory))
                    if unacknowledged_xml is not None:
                        action_path=folder/f'action-{self.hierarchy_sequence:04}.unacknowledged.xml';action_path.write_text(unacknowledged_xml)
                        evidence['unacknowledgedActionXml']=str(action_path.relative_to(directory))
                    (folder/f'dump-{self.hierarchy_sequence:04}.json').write_text(json.dumps(evidence,indent=2,ensure_ascii=False))
            if archive_error:raise archive_error

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
        return usable_viewport(w,h,density,self.shell('dumpsys','window','displays',check=False))

    def find_control(self,label,match='exact',search='default'):
        if search not in {'default','below'}:raise ValueError('Unknown control search policy')
        viewport=self.viewport()
        attempts=13 if search=='below' else 7
        for attempt in range(attempts):
            xml=self.dump()
            try:
                point=target_bounds(xml,label,match=match,viewport=viewport)
            except RuntimeError as error:
                reverse=(error.direction=='up') if isinstance(error,ControlOutsideViewport) else (search=='default' and attempt>=3)
                diagnostic=self.search_snapshot(label,attempt,xml,viewport,'searching',str(error),reverse) if search=='below' else None
                if attempt==attempts-1:raise
                if not self.scroll_down(reverse=reverse):raise error
                if diagnostic:
                    diagnostic['swipe']=getattr(self,'last_scroll_gesture',None)
                    self.write_search_metadata(diagnostic)
            else:
                if search=='below':self.search_snapshot(label,attempt,xml,viewport,'control-visible',point=point)
                return point

    def write_search_metadata(self,record):
        path=record.get('_metadata_path')
        if path:
            Path(path).write_text(json.dumps({key:value for key,value in record.items() if not key.startswith('_')},indent=2,ensure_ascii=False))

    def search_snapshot(self,label,step,xml,viewport,state,error=None,reverse=False,point=None):
        directory=getattr(self,'capture_directory',None)
        if directory is None:return None
        folder=Path(directory)/'diagnostics'/'project-submit-search';folder.mkdir(parents=True,exist_ok=True)
        prefix=folder/f'step-{step:02}'
        root=ET.fromstring(xml)
        scrolls=[dict(bounds=node.get('bounds'),className=node.get('class')) for node in root.iter('node')
                 if node.get('scrollable')=='true' and node.get('package')==PACKAGE]
        record=dict(step=step,label=label,searchPolicy='known-below',state=state,error=error,viewport=viewport,
                    nextScrollDirection='up' if reverse else 'down',point=point,scrollContainers=scrolls,
                    xmlCapturedAt=datetime.now(timezone.utc).isoformat(),visibleText=ui_strings(xml),
                    xml=str(prefix.with_suffix('.xml').relative_to(directory)),png=str(prefix.with_suffix('.png').relative_to(directory)),
                    _metadata_path=str(prefix.with_suffix('.json')))
        prefix.with_suffix('.xml').write_text(xml)
        image=self.run('exec-out','screencap','-p',binary=True)
        if image[:8]!=b'\x89PNG\r\n\x1a\n':raise RuntimeError('Search diagnostic screencap was not a native PNG')
        prefix.with_suffix('.png').write_bytes(image)
        record['pngCapturedAt']=datetime.now(timezone.utc).isoformat()
        self.write_search_metadata(record)
        self.search_diagnostics.append(str(prefix.with_suffix('.json').relative_to(directory)))
        return record

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
            return False  # Never turn a missing/clipped footer into a swipe on its dismissing backdrop.
        x=(x1+x2)//2
        start=int(y1+(y2-y1)*.85);end=int(y1+(y2-y1)*.25)
        if reverse:start,end=end,start
        self.last_scroll_gesture=dict(x=x,startY=start,endY=end,durationMs=350,scrollBounds=[x1,y1,x2,y2])
        self.shell('input','swipe',x,start,x,end,350)
        time.sleep(.5)
        return True

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

    def tap(self,label,match='exact',search='default'):
        x,y=self.find_control(label,match=match,search=search)
        self.shell('input', 'tap', x, y)
        time.sleep(1)

    def activate(self,label,search='default',prequery=True):
        """Invoke one frontend accessibility action in the same fresh connection."""
        if not self.native_hierarchy_jar:raise RuntimeError('Native accessibility activation is unavailable; no coordinate fallback is allowed')
        point=self.find_control(label,search=search) if prequery else None  # Never tap this coordinate; direct mode preserves the open IME.
        xml=self.dump(click_label=label)
        proof=self.last_hierarchy_evidence
        if not proof.get('acknowledged') or proof.get('nativeActionCount')!=1:
            raise RuntimeError('Exactly one acknowledged native accessibility action is required')
        return dict(method='AccessibilityNodeInfo.ACTION_CLICK',label=label,nativeActionCount=1,nativeClickActionCount=1,
                    nativeShowOnScreenActionCount=proof.get('nativeShowOnScreenActionCount',0),prequeryPoint=point,physicalPrequeryActionCount=0 if not prequery else None,preactionAttributes=ET.fromstring(xml).attrib,hierarchyAction=proof)

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

    def seed(self, populated, font_size='medium', theme_mode='dark', intro_seen=True):
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
            write_storage(db, fixture_values(app_dir, populated, font_size, theme_mode, intro_seen=intro_seen))
            self.shell('run-as', PACKAGE, 'rm', '-f', 'databases/RKStorage-wal', 'databases/RKStorage-shm', 'databases/RKStorage-journal')
            self.shell('run-as', PACKAGE, 'sh', '-c', 'cat > databases/RKStorage', data=db.read_bytes())
        return app_dir


def capture(device, directory, name, route, expected, action=None, open_route=True):
    record = dict(profile=directory.name, screen=name, route=route, expected=expected, startedAt=datetime.now(timezone.utc).isoformat())
    device.capture_directory=directory
    device.search_diagnostics=[]
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
        if name=='video-overlay':
            device.find_control('우측 하단')
            xml=device.ready(expected)
        if name in {'video-photos','video-interval','video-quality','video-ratio','video-overlay'}:
            record['optionSheetEvidence']=option_sheet_evidence(xml,device.viewport(),require_scroll=name=='video-overlay')
        if name=='camera':record['cameraHeaderEvidence']=camera_header_evidence(xml)
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
    if device.search_diagnostics:record['controlSearchDiagnostics']=device.search_diagnostics
    (directory / f'{name}.json').write_text(json.dumps(record, indent=2, ensure_ascii=False))
    detail=': '+record['error'] if record['status']=='failed' else ''
    print(f"{directory.name}/{name}: {record['status']}{detail}", flush=True)
    return record




def replace_focused_input(device,value):
    """Replace the whole40-character project field, then verify native exact text."""
    def focused_value(xml):
        for node in ET.fromstring(xml).iter('node'):
            if node.get('class')=='android.widget.EditText' and node.get('focused')=='true':
                return node.get('text','')
        raise RuntimeError('Expected project EditText is not focused')
    focused_value(device.dump())
    device.shell('input','keyevent','KEYCODE_MOVE_END')
    device.shell('input','keyevent',*(['KEYCODE_DEL']*40))
    device.shell('input','text',value)
    for attempt in range(3):
        actual=focused_value(device.dump())
        if actual==value:return dict(inputExactlySet=True,value=value)
        if attempt<2:time.sleep(.2)
    raise RuntimeError(f'Project input did not exactly match the requested synthetic name: {actual!r}')


def open_project_reminder(device):
    # The Stage 10 project layout keeps reminder settings under the dedicated statistics tab.
    device.ready(['QA 데모', '기록'])
    device.tap('통계')
    device.ready(['기록 달성률', '촬영 알림'])
    device.tap('프로젝트 촬영 알림 설정', search='below')


def creation_keyboard(device):
    device.ready(['내 프로젝트'])
    device.tap('새 프로젝트 만들기')
    device.shell('settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1')
    xml = device.ready(['프로젝트 이름', '목표 기록 수'])
    for node in ET.fromstring(xml).iter('node'):
        if node.get('class') == 'android.widget.EditText':
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
            device.shell('input', 'tap', (x1+x2)//2, (y1+y2)//2)
            time.sleep(2)
            evidence=replace_focused_input(device,'QA_keyboard_large_font')
            state = device.shell('dumpsys', 'input_method')
            if not re.search(r'(?:mInputShown|isInputViewShown|mIsInputViewShown)=true', state):
                raise RuntimeError('Project input focus did not show the native keyboard')
            return dict(evidence,keyboardShown=True)
    raise RuntimeError('Project name input not found')


def onboarding_welcome(device):
    device.ready(['기준 사진 표시'])
    device.tap('사용 가이드',match='summary')
    device.ready(['바디 프레임에 오신 것을 환영합니다.'])
    device.find_control('다음')  # Scroll inside the real guide when large text pushes it below the fold.


def onboarding_scrolled(device):
    onboarding_welcome(device)
    device.tap('다음')
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




def actual_ime_visibility(window_displays,input_method):
    """Use actual window/source status; requested InputShown flags are not evidence."""
    sources=[]
    for line in window_displays.splitlines():
        if re.search(r'(?:mType|type)=ime(?=[\s,}])',line):
            state=re.search(r'(?:mVisible|visible)=(true|false)',line)
            if state:sources.append(state[1]=='true')
    if sources:return dict(visible=any(sources),source='WindowManager.InsetsSource.ime',sourceStates=sources)
    values=re.findall(r'\bmImeWindowVis=(0x[0-9a-fA-F]+|\d+)',input_method)
    bits={int(value,16 if value.lower().startswith('0x') else 10) for value in values}
    if len(bits)==1:
        status=next(iter(bits))
        return dict(visible=bool(status&0x2),source='InputMethodManagerService.mImeWindowVis',statusBits=status)
    return dict(visible=None,source='unknown-actual-ime-visibility')


def ensure_keyboard_hidden(device):
    observations=[]
    directory=getattr(device,'capture_directory',None)
    folder=Path(directory)/'diagnostics'/'ime-visibility' if directory is not None else None
    if folder:folder.mkdir(parents=True,exist_ok=True)
    def observe(stage):
        displays=device.shell('dumpsys','window','displays')
        windows=device.shell('dumpsys','window','windows')
        method=device.shell('dumpsys','input_method')
        evidence=dict(stage=stage,capturedAt=datetime.now(timezone.utc).isoformat(),**actual_ime_visibility(displays,method))
        if folder:
            for suffix,text in [('window-displays',displays),('window-windows',windows),('input-method',method)]:
                path=folder/f'{stage}-{suffix}.txt';path.write_text(text);evidence[suffix]=str(path.relative_to(directory))
            (folder/f'{stage}.json').write_text(json.dumps(evidence,indent=2))
        observations.append(evidence)
        return evidence
    before=observe('before')
    if before['visible'] is None:raise RuntimeError('Actual IME visibility is unknown; requested InputShown flags cannot authorize a Back action')
    keyboard_was_shown=before['visible']
    if keyboard_was_shown:device.shell('input','keyevent','KEYCODE_BACK')
    deadline=time.monotonic()+8;attempt=0
    while True:
        current=observe(f'after-{attempt:02}');attempt+=1
        if current['visible'] is False:
            return dict(hiddenConfirmed=True,keyboardWasShown=keyboard_was_shown,confirmation=current['source'],observations=observations)
        if time.monotonic()>deadline:raise RuntimeError(f'Actual IME hidden state was not confirmed before submission scrolling: {current}')
        time.sleep(.2)


def record_ime_visibility(device,stage):
    displays=device.shell('dumpsys','window','displays')
    windows=device.shell('dumpsys','window','windows')
    method=device.shell('dumpsys','input_method')
    record=dict(stage=stage,capturedAt=datetime.now(timezone.utc).isoformat(),**actual_ime_visibility(displays,method))
    directory=getattr(device,'capture_directory',None)
    if directory:
        folder=Path(directory)/'diagnostics/ime-visibility';folder.mkdir(parents=True,exist_ok=True)
        for suffix,text in [('window-displays',displays),('window-windows',windows),('input-method',method)]:
            path=folder/f'{stage}-{suffix}.txt';path.write_text(text);record[suffix]=str(path.relative_to(directory))
        (folder/f'{stage}.json').write_text(json.dumps(record,indent=2))
    return record


def creation_submit(device):
    # Continue from the real keyboard screenshot; native SHOW_ON_SCREEN avoids a
    # physical drag (on-drag dismisses IME) or Back-induced resize before CLICK.
    before=record_ime_visibility(device,'submit-keyboard-before')
    if before['visible'] is not True:raise RuntimeError('Actual native keyboard must remain visible before direct submission')
    activation=device.activate('프로젝트 만들기',prequery=False)
    after=record_ime_visibility(device,'submit-keyboard-after')
    device.ready(['QA_keyboard_large_font 프로젝트 열기'])
    projects=json.loads(device.storage().get('body-frame.projects.v1','[]'))
    if len(projects)!=1 or projects[0].get('name')!='QA_keyboard_large_font':
        raise RuntimeError('Large-font keyboard form did not persist the newly created project')
    return dict(projectPersisted=True,project=projects[0],keyboardDismissedForSubmit=False,keyboardVisibleBeforeActivation=True,
                physicalBackActionCount=0,physicalDragActionCount=0,imeVisibilityEvidence=dict(before=before,after=after),submitActivation=activation)


def no_export_side_effects(before, after):
    for key in ['travel-frame.videos.v1','guestWeeklyVideoExportUsage']:
        if before.get(key)!=after.get(key):
            raise ValueError(f'Failed/cancelled export changed persisted video/quota state: {key}')
    return dict(videosUnchanged=True, guestQuotaUnchanged=True)


def wait_export_terminal(device, expected_error=None, seconds=90):
    """Wait for actual terminal evidence; the idle button may still be visible immediately after a tap."""
    deadline=time.monotonic()+seconds
    last_strings=[]
    while time.monotonic()<deadline:
        xml=device.dump();strings=ui_strings(xml)
        last_strings=strings
        running=any('영상 만드는 중' in value for value in strings)
        button=any(value.strip()=='영상 만들기' for value in strings)
        expected_visible=not expected_error or any(
            any(marker in value for marker in expected_error) for value in strings
        )
        if not running and button and expected_visible:
            return strings
        time.sleep(1)
    raise RuntimeError(f'Native export did not show the expected terminal state within {seconds} seconds: {last_strings}')


def set_interval(device, value):
    device.tap('사진 간격',match='summary');device.ready(['사진 간격','적용'])
    device.tap(f'{value}초');device.tap('적용')
    device.ready([f'사진 간격 설정, 현재 {value}초'])



def await_log_marker(device,monitor,evidence,marker,seconds=3):
    """Handshake with the logcat reader before injecting any export action."""
    start=time.monotonic();deadline=start+seconds;next_emit=start;emissions=0
    pattern=re.compile(r'^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+\d+\s+\d+\s+[VDIWEF]\s+BodyFrameQA\s*:\s*'+re.escape(marker)+r'\s*$',re.MULTILINE)
    while time.monotonic()<deadline:
        now=time.monotonic()
        if now>=next_emit:
            # Re-emit only before the tap so a slow logcat startup cannot lose
            # the sole -T1 sentinel. All copies precede native recording work.
            device.shell('log','-p','i','-t','BodyFrameQA',marker,timeout=max(.1,min(1,deadline-now)))
            emissions+=1;next_emit=time.monotonic()+.4
        if select.select([monitor.stdout],[],[],.05)[0]:
            chunk=os.read(monitor.stdout.fileno(),65536)
            if not chunk:raise RuntimeError('Logcat exited before marker acknowledgement; export was not tapped')
            evidence.extend(chunk)
            if pattern.search(evidence.decode(errors='replace')):
                return dict(markerObserved=True,waitSeconds=round(time.monotonic()-start,3),emissions=emissions)
        if monitor.poll() is not None:raise RuntimeError('Logcat stopped before marker acknowledgement; export was not tapped')
    raise RuntimeError('Logcat marker acknowledgement timed out; export was not tapped')


def begin_monitored_export(device,monitor,evidence,marker,x,y):
    ack=await_log_marker(device,monitor,evidence,marker)
    start=time.monotonic()  # The encoder deadline excludes the reader handshake.
    device.shell('input','tap',x,y)
    return start,ack


def background_during_native_encoder(device, directory):
    """Observe fresh app encoder/session/muxer events before sending HOME."""
    pid=device.shell('pidof',PACKAGE).strip()
    if not re.fullmatch(r'\d+',pid):raise RuntimeError('Cannot identify the running app process')
    x,y=device.find_control('영상 만들기')
    marker='QA_EXPORT_BEGIN_'+uuid.uuid4().hex
    # The shell-PID marker must be observable; filter app PID inside the parser.
    monitor=subprocess.Popen([*device.prefix,'logcat','-b','main','-v','threadtime','-T','1'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    evidence=bytearray();observed=None
    try:
        start,marker_ack=begin_monitored_export(device,monitor,evidence,marker,x,y)
        while time.monotonic()-start<2.5:
            if select.select([monitor.stdout],[],[],.05)[0]:
                chunk=os.read(monitor.stdout.fileno(),65536)
                if not chunk:break
                evidence.extend(chunk)
                observed=fresh_muxer_evidence(evidence.decode(errors='replace'),int(pid),marker)
                if observed:
                    device.shell('input','keyevent','KEYCODE_HOME')
                    background_sent_after=time.monotonic()-start
                    break
        if not observed:raise RuntimeError('No fresh in-flight app encoder/ready/muxer sequence before background deadline; cancellation case not proven')
        (directory/'video-background-home.png').write_bytes(device.run('exec-out','screencap','-p',binary=True))
        (directory/'video-background-home.xml').write_text(device.dump())
        device.shell('am','start','-W','-a','android.intent.action.MAIN','-c','android.intent.category.LAUNCHER','-n',PACKAGE+'/.MainActivity')
        now=device.shell('pidof',PACKAGE).strip()
        if now!=pid:raise RuntimeError('Background recovery restarted the process instead of preserving the native guard')
        strings=wait_export_terminal(device,['영상 만들기가 취소되었습니다'])
        return dict(encoderStartObserved=True,markerAcknowledgement=marker_ack,nativeStartEvidence=observed,backgroundWithinSeconds=round(background_sent_after,3),
                    pidBefore=pid,pidAfter=now,terminalText=strings)
    finally:
        monitor.terminate()
        try:evidence.extend(monitor.communicate(timeout=3)[0] or b'')
        except subprocess.TimeoutExpired:monitor.kill();monitor.communicate()
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
            for _ in range(3):
                if not device.scroll_down(reverse=True):break
        device.ready(['변화 영상 만들기', 'QA 데모'])
        device.tap('영상 만들기')
        result['createClicks'] = 1
        started = time.monotonic()
        while time.monotonic()-started < 180:
            xml = device.dump()
            strings = ui_strings(xml)
            running = any('영상 만드는 중' in value for value in strings)
            if (not running and time.monotonic()-started > 2
                    and any(value.strip() == '영상 만들기' for value in strings)
                    and any('앨범에 저장했습니다.' in value for value in strings)):
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
        # The persisted-media audit intentionally force-stops the app. Preserve
        # the original export failure rather than inventing a second capture failure.
        activity=device.shell('dumpsys','activity','activities',check=False)
        resumed='\n'.join(line for line in activity.splitlines()
                          if 'ResumedActivity' in line or 'topResumedActivity' in line)
        if PACKAGE in resumed:
            records.append(capture(device, directory, 'video-export-result', 'video-create', [], open_route=False))
        else:
            result['captureSkippedReason']='App not foreground after inspection; original failure retained'
    (directory / 'video-native-export.json').write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"{directory.name}/video-native-export: {result['status']}", flush=True)
    records.append(result)
    return records


def wait_for_visual_profile(device, size, density, timeout_seconds=25):
    """Wait for the actual Android screenshot surface after wm size/density changes."""
    expected = tuple(int(part) for part in size.split('x'))
    deadline = time.monotonic() + timeout_seconds
    observed = None
    while True:
        screenshot = device.run('exec-out', 'screencap', '-p', binary=True)
        if screenshot[:8] != b'\x89PNG\r\n\x1a\n' or len(screenshot) < 24:
            raise RuntimeError('Native screenshot surface did not return a valid PNG')
        observed = struct.unpack('>II', screenshot[16:24])
        if observed == expected:
            return {'requestedPixels': list(expected), 'observedPixels': list(observed), 'density': density}
        if time.monotonic() >= deadline:
            raise RuntimeError(f'Display viewport did not settle: requested={expected}, captured={observed}')
        time.sleep(.5)


def capture_design_matrix(device, output, records, manifest):
    """Capture actual Android UI on disposable offline guest fixtures at four dp widths."""
    screens = [
        ('camera', 'camera', ['프로젝트 선택', '사진 촬영'], None),
        ('records', 'studio', ['QA 데모', '내 프로젝트'], None),
        ('project', f'project/{PROJECT}', ['QA 데모', '프로젝트 설정 열기'], None),
        ('compare', f'project/{PROJECT}/compare', ['전후 사진 비교', '첫 사진', '마지막 사진'], None),
        ('measurements', f'project/{PROJECT}/measurements', ['수치 기록', 'QA 데모'], None),
        ('video-home', 'trip-clip', ['변화 영상 만들기'], None),
        ('video-create', 'video-create', ['변화 영상 만들기', 'QA 데모'], None),
        ('video-library', 'video-library', ['영상 관리', '저장한 영상'], None),
        ('settings', 'settings', ['설정', '기준 사진 표시'], None),
        ('account', 'account', ['로그인하고 기록을 보호하세요.'], None),
        ('project-settings', f'project/{PROJECT}', ['프로젝트 설정', '변경 저장', '이름'],
         (['프로젝트 설정 열기'], '프로젝트 설정 열기')),
        ('video-photos', 'video-create', ['사진 선택', '전체 선택'],
         (['변화 영상 만들기'], '사진 수', 'summary')),
    ]
    manifest['visualDesignMatrix'] = {
        'profiles': [{'name': p, 'size': size, 'density': dpi,
                      'widthDp': round(int(size.split('x')[0]) * 160 / dpi)}
                     for p, size, dpi in DESIGN_PROFILES],
        'variants': [{'name': name, 'theme': theme, 'appFont': font, 'systemFontScale': scale}
                     for name, theme, font, scale in DESIGN_VARIANTS],
        'screens': [name for name, _, _, _ in screens],
        'screenshotsAreActualAndroid': True,
        'designGuideMatchRequiresVisualReview': True,
        'notTested': ['TalkBack spoken order', 'real login and Play Billing',
                      'Health Connect', 'signed Play installation', 'private user media'],
    }
    for profile, size, density in DESIGN_PROFILES:
        device.shell('am', 'force-stop', PACKAGE)
        device.shell('wm', 'size', size)
        device.shell('wm', 'density', density)
        settled = wait_for_visual_profile(device, size, density)
        manifest['visualDesignMatrix'].setdefault('displaySettleEvidence', {})[profile] = settled
        for variant, theme, app_font, system_scale in DESIGN_VARIANTS:
            directory = output / profile / variant
            directory.mkdir(parents=True, exist_ok=True)
            device.shell('settings', 'put', 'system', 'font_scale', system_scale)
            device.seed(True, app_font, theme_mode=theme)
            for name, route, expected, action in screens:
                record = capture(device, directory, name, route, expected, action)
                record.update(profile=profile, variant=variant,
                              theme=theme, fontScale=system_scale, appFont=app_font)
                (directory / f'{name}.json').write_text(json.dumps(record, indent=2, ensure_ascii=False))
                records.append(record)
            if variant == 'dark-150':
                record = capture(device, directory, 'onboarding-large-font', 'settings',
                                 ['바디 프레임에 오신 것을 환영합니다.', '다음'],
                                 onboarding_welcome)
                record.update(profile=profile, variant=variant, theme=theme,
                              fontScale=system_scale, appFont=app_font)
                records.append(record)
            if variant == 'dark-100':
                device.seed(False, app_font, theme_mode=theme)
                record = capture(device, directory, 'empty-projects', 'studio',
                                 ['내 프로젝트'], None)
                record.update(profile=profile, variant=variant, theme=theme, fontScale=system_scale)
                records.append(record)
        (output / profile / 'device.txt').write_text(
            device.shell('wm', 'size') + device.shell('wm', 'density') +
            device.shell('getprop', 'ro.build.version.sdk'))
    device.shell('settings', 'put', 'system', 'font_scale', '1.0')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--serial')
    parser.add_argument('--trust-manifest',type=Path)
    parser.add_argument('--scenario', choices=('all','keyboard','visual'), default='all')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if args.scenario == 'all':
        fixtures=args.output/'synthetic-fixtures';fixtures.mkdir(exist_ok=True)
        for index in (1,2,3):
            for preview in (False,True):
                (fixtures/f'card-{index}{"-preview" if preview else ""}.jpg').write_bytes(fixture_jpeg(index,preview))
    device = Device(args.serial)
    records = []
    manifest = dict(package=PACKAGE, scenario=args.scenario, apkSha256=hashlib.sha256(args.apk.read_bytes()).hexdigest(),
                    fixture=('empty synthetic guest library; no user images' if args.scenario == 'keyboard' else
                             'host-generated synthetic monochrome numbered cards1/2/3; no user images'),
                    network='emulator Wi-Fi and mobile data disabled; no authentication configured',
                    limits=['No signed-in/cloud/billing operations', 'No actual Health Connect import',
                            'Photo editor requires login: guest capture shows the real login-required alert'], captures=records)
    if args.trust_manifest:
        manifest['apkTrust']=json.loads(args.trust_manifest.read_text())
    try:
        if device.shell('getprop', 'ro.kernel.qemu').strip() != '1':
            raise RuntimeError('Refusing to seed a physical Android device')
        device.run('install', '-r', '-g', args.apk.resolve())
        manifest['hierarchyBackend']=prepare_native_hierarchy(device,args.output)
        device.shell('svc', 'wifi', 'disable')
        device.shell('svc', 'data', 'disable')
        device.shell('input', 'keyevent', 'KEYCODE_WAKEUP')
        device.shell('wm', 'dismiss-keyguard')
        if args.scenario == 'visual':
            capture_design_matrix(device, args.output, records, manifest)
        else:
            for profile, size, density in PROFILES:
                device.shell('am', 'force-stop', PACKAGE)
                device.shell('wm', 'size', size)
                device.shell('wm', 'density', density)
                time.sleep(3)
                directory = args.output / profile
                directory.mkdir(exist_ok=True)
                if args.scenario == 'all':
                    device.seed(False)
                    record = capture(device, directory, 'create-project', 'studio', ['프로젝트 이름', '목표 기록 수'],
                                     (['내 프로젝트'], '새 프로젝트 만들기'))
                    record['profile'] = profile
                    records.append(record)
                device.seed(False, 'large')
                device.shell('settings', 'put', 'system', 'font_scale', '1.3')
                records.append(capture(device, directory, 'create-project-large-font-keyboard', 'studio',
                                       ['프로젝트 이름'], creation_keyboard))
                records.append(capture(device,directory,'create-project-large-font-submitted','studio',
                                       ['QA_keyboard_large_font'],creation_submit,open_route=False))
                device.shell('settings', 'put', 'system', 'font_scale', '1.0')
                if args.scenario == 'keyboard':
                    (directory / 'device.txt').write_text(device.shell('wm', 'size') + device.shell('wm', 'density') + device.shell('getprop', 'ro.build.version.sdk'))
                    continue
                device.seed(True)
                screens = [
                    ('camera', 'camera', ['프로젝트 선택', '사진 촬영'], None),
                    ('records', 'studio', ['QA 데모', '내 프로젝트'], None),
                    ('project', f'project/{PROJECT}', ['QA 데모', '프로젝트 설정 열기'], None),
                    ('project-metrics', f'project/{PROJECT}', ['QA 데모', '수치 기록', '전체 수치 기록 보기'], (['QA 데모'], '수치')),
                    ('project-stats', f'project/{PROJECT}', ['QA 데모', '기록 달성률', '촬영 알림'], (['QA 데모'], '통계')),
                    ('project-settings', f'project/{PROJECT}', ['프로젝트 설정', '변경 저장', '이름'], (['프로젝트 설정 열기'], '프로젝트 설정 열기')),
                    ('project-reminder', f'project/{PROJECT}', ['촬영 알림 설정 닫기', '촬영 알림', '요일'], open_project_reminder),
                    ('photo', f'photo/{PHOTO}', ['기록 상세'], None),
                    ('photo-measurement', f'photo/{PHOTO}?measurement=1', ['몸무게', '체지방률', '저장'], None),
                    ('edit-login-required', 'edit?' + urlencode({'photoId': PHOTO}), ['로그인이 필요합니다', '사진 편집은 무료 로그인부터'], None),
                    ('compare', f'project/{PROJECT}/compare', ['전후 사진 비교', '첫 사진', '마지막 사진'], None),
                    ('measurements', f'project/{PROJECT}/measurements', ['수치 기록', 'QA 데모'], None),
                    ('measurement-create', f'project/{PROJECT}/measurements?add=1', ['몸무게', '저장'], None),
                    ('video', 'trip-clip', ['변화 영상 만들기'], None),
                    ('video-create', 'video-create', ['변화 영상 만들기', 'QA 데모'], None),
                    ('video-photos', 'video-create', ['사진 선택', '전체 선택'], (['변화 영상 만들기'], '사진 수','summary')),
                    ('video-interval', 'video-create', ['사진 간격', '적용'], (['변화 영상 만들기'], '사진 간격','summary')),
                    ('video-quality', 'video-create', ['영상 화질', '적용'], (['변화 영상 만들기'], '화질','summary')),
                    ('video-ratio', 'video-create', ['화면 비율', '적용'], (['변화 영상 만들기'], '화면 비율','summary')),
                    ('video-overlay', 'video-create', ['텍스트 오버레이', '적용'], (['변화 영상 만들기'], '텍스트','summary')),
                    ('video-library', 'video-library', ['영상 관리', '저장한 영상'], None),
                    ('settings', 'settings', ['설정', '기준 사진 표시'], None),
                    ('settings-reference', 'settings', ['기준 사진 표시', '닫기'], (['기준 사진 표시'], '기준 사진 표시','summary')),
                    ('legacy-studio', 'legacy-studio', ['사진과 영상을 관리하세요.'], None),
                    ('legacy-advanced-settings', 'advanced-settings', ['기본값 설정'], None),
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
                                       ['바디 프레임에 오신 것을 환영합니다.', '다음'], onboarding_welcome))
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
