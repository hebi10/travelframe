#!/usr/bin/env python3
"""Host-only checks for fixture integrity and UI selector interpretation."""
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import Mock, call, patch

spec = importlib.util.spec_from_file_location('capture_qa', Path(__file__).with_name('capture-android-qa.py'))
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


class CaptureHelpersTest(unittest.TestCase):
    def test_launcher_anr_preflight_ignores_healthy_emulator(self):
        device = Mock()
        device.shell.side_effect = lambda *args, **kwargs: '1' if args == ('getprop', 'ro.kernel.qemu') else ''
        device.dump.return_value = '<hierarchy><node text="BODY FRAME" /></hierarchy>'
        with tempfile.TemporaryDirectory() as tmp:
            evidence = qa.recover_launcher_anr(device, Path(tmp))
        self.assertEqual(evidence['status'], 'healthy')
        self.assertFalse(evidence['recovered'])
        device.run.assert_not_called()
        self.assertNotIn(call('am', 'force-stop', 'com.google.android.apps.nexuslauncher'), device.shell.call_args_list)

    def test_launcher_anr_preflight_preserves_evidence_and_recovers_only_once(self):
        device = Mock()
        dialog = '<hierarchy><node text="Pixel Launcher isn&#39;t responding"/><node text="Close app"/><node text="Wait"/></hierarchy>'
        device.shell.side_effect = lambda *args, **kwargs: '1' if args == ('getprop', 'ro.kernel.qemu') else ''
        device.dump.side_effect = [dialog, '<hierarchy><node text="Home"/></hierarchy>']
        png = b'\x89PNG\r\n\x1a\n' + bytes(35)
        device.run.return_value = png
        with tempfile.TemporaryDirectory() as tmp, patch.object(qa.time, 'sleep') as sleep:
            folder = Path(tmp)
            evidence = qa.recover_launcher_anr(device, folder)
            self.assertEqual((folder / 'launcher-anr.before.png').read_bytes(), png)
            self.assertIn('Pixel Launcher', (folder / 'launcher-anr.before.xml').read_text())
            self.assertTrue((folder / 'launcher-anr.after.xml').exists())
        self.assertEqual(evidence['status'], 'recovered')
        device.shell.assert_any_call('am', 'force-stop', 'com.google.android.apps.nexuslauncher')
        device.shell.assert_any_call('input', 'keyevent', 'KEYCODE_BACK')
        self.assertEqual(device.dump.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_launcher_anr_preflight_never_modifies_physical_device(self):
        device = Mock()
        device.shell.return_value = '0'
        with self.assertRaisesRegex(RuntimeError, 'disposable Android emulator'):
            qa.recover_launcher_anr(device, Path('/tmp/unused'))
        device.dump.assert_not_called()
        device.run.assert_not_called()

    def test_launcher_anr_in_screen_readiness_fails_fast_with_system_reason(self):
        device = qa.Device()
        device.dump = Mock(return_value='<hierarchy><node text="Pixel Launcher isn&#39;t responding" /></hierarchy>')
        with self.assertRaisesRegex(RuntimeError, 'system Pixel Launcher ANR'):
            device.ready(['프로젝트 이름'], seconds=2)
        device.dump.assert_called_once()

    def test_launcher_anr_preflight_does_not_hide_other_app_or_persistent_anr(self):
        device = Mock()
        device.shell.side_effect = lambda *args, **kwargs: '1' if args == ('getprop', 'ro.kernel.qemu') else ''
        dialog = '<hierarchy><node text="Pixel Launcher isn&#39;t responding"/><node text="Close app"/><node text="Wait"/></hierarchy>'
        device.dump.side_effect = [dialog, dialog]
        device.run.return_value = b'\x89PNG\r\n\x1a\n' + bytes(35)
        with tempfile.TemporaryDirectory() as tmp, patch.object(qa.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'persisted after one bounded'):
                qa.recover_launcher_anr(device, Path(tmp))
        self.assertEqual(device.dump.call_count, 2)

    def test_click_uses_clickable_parent_bounds_and_ignores_disabled_control(self):
        xml = '''<hierarchy><node clickable="true" enabled="false" bounds="[0,0][100,100]" content-desc="사진 수"/><node clickable="true" enabled="true" bounds="[10,40][310,100]"><node text="사진 수" enabled="true" bounds="[20,50][70,80]"/></node></hierarchy>'''
        self.assertEqual(qa.target_bounds(xml, '사진 수'), (160, 70))
        with self.assertRaises(RuntimeError):
            qa.target_bounds(xml, '삭제')

    def test_visual_profile_awaits_actual_screenshot_dimensions(self):
        import struct
        def png(width, height):
            return b'\x89PNG\r\n\x1a\n' + b'\x00'*8 + struct.pack('>II', width, height)
        device = Mock()
        device.run.side_effect = [png(900, 1600), png(1125, 1800)]
        with patch.object(qa.time, 'sleep'):
            proof = qa.wait_for_visual_profile(device, '1125x1800', 240)
        self.assertEqual(proof['observedPixels'], [1125, 1800])
        self.assertEqual(device.run.call_count, 2)
        device.run.side_effect = [png(900, 1600)]
        with patch.object(qa.time, 'monotonic', side_effect=[0, 1]), patch.object(qa.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'Display viewport did not settle'):
                qa.wait_for_visual_profile(device, '1125x1800', 240, timeout_seconds=.5)

    def test_versioned_rkstorage_fixture_has_no_cloud_owner_or_auth(self):
        import json
        values = qa.fixture_values('/data/user/0/' + qa.PACKAGE)
        projects = json.loads(values['body-frame.projects.v1'])
        photos = json.loads(values['travel-frame.photos.v1'])
        self.assertEqual(len(projects), 1)
        self.assertEqual([photo['sequence'] for photo in photos], [1, 2, 3])
        self.assertEqual(len({photo['uri'] for photo in photos}), 3)
        self.assertTrue(all(photo['projectId'] == projects[0]['id'] for photo in photos))
        self.assertTrue(all('/photo-' + photo['id'] + '.jpg' in photo['uri'] for photo in photos))
        self.assertFalse(any('firebase' in key or 'owner' in key for key in values))
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'RKStorage'
            qa.write_storage(path, values)
            with sqlite3.connect(path) as db:
                self.assertEqual(db.execute('PRAGMA user_version').fetchone()[0], 1)
                self.assertEqual(dict(db.execute('SELECT key,value FROM catalystLocalStorage')), values)

    def test_empty_fixture_allows_new_project_sheet(self):
        import json
        values = qa.fixture_values('/data/user/0/' + qa.PACKAGE, False)
        self.assertEqual(json.loads(values['body-frame.projects.v1']), [])
        self.assertNotIn('body-frame.last-active-project-id.v1', values)

    def test_private_video_extraction_refuses_remote_other_package_and_traversal(self):
        app = '/data/user/0/' + qa.PACKAGE
        self.assertEqual(qa.private_video_path('file://' + app + '/files/made-videos/123-demo.mp4', app), 'files/made-videos/123-demo.mp4')
        for uri in ['https://example.com/a.mp4', 'file:///data/user/0/other/files/made-videos/a.mp4', 'file://' + app + '/files/made-videos/%2e%2e/a.mp4']:
            with self.assertRaises(ValueError):
                qa.private_video_path(uri, app)

    def test_native_probe_requires_expected_codec_dimensions_frames_and_duration(self):
        probe = {'streams': [{'codec_type': 'video', 'codec_name': 'h264', 'width': 1080, 'height': 1440, 'nb_read_frames': '9'}], 'format': {'duration': '0.300'}}
        self.assertEqual(qa.validate_video_probe(probe)['duration'], 0.3)
        for key, value in [('codec_name', 'mpeg4'), ('width', 720), ('nb_read_frames', '1')]:
            broken = {'streams': [dict(probe['streams'][0], **{key: value})], 'format': probe['format']}
            with self.assertRaises(ValueError):
                qa.validate_video_probe(broken)
        with self.assertRaises(ValueError):
            qa.validate_video_probe({'streams': probe['streams'], 'format': {'duration': '0'}})

    def test_fixture_markers_distinguish_every_photo_and_reject_blank_or_stale_pixels(self):
        for index in (1, 2, 3):
            pixels = qa.pattern_rgb(index, 120, 160)
            self.assertEqual(len(pixels), 120*160*3)
            self.assertEqual(qa.validate_marker_pixels(pixels, 120, 160, index)['photo'], index)
        for pixels, index in [(bytes(120*160*3), 1), (qa.pattern_rgb(1,120,160), 2)]:
            with self.assertRaises(ValueError):
                qa.validate_marker_pixels(pixels,120,160,index)

    def test_native_probe_requires_exact_frame_count_and_one_frame_duration_tolerance(self):
        stream = {'codec_type':'video','codec_name':'h264','width':1080,'height':1440}
        for frames, duration in [(None, '0.3'), ('N/A','0.3'), ('9','0.9'), ('9','0.2')]:
            with self.assertRaises(ValueError):
                qa.validate_video_probe({'streams':[dict(stream,nb_read_frames=frames)],'format':{'duration':duration}})

    def test_export_terminal_waits_for_real_feedback_instead_of_accepting_initial_idle_button(self):
        idle='<hierarchy><node text="영상 만들기"/></hierarchy>'
        busy='<hierarchy><node text="영상 만드는 중 5%"/></hierarchy>'
        terminal='<hierarchy><node text="사진 원본을 확인하지 못했습니다"/><node text="영상 만들기"/></hierarchy>'
        device=Mock()
        device.dump.side_effect=[idle,busy,terminal]
        with patch.object(qa.time,'monotonic',side_effect=[0,1,2,3]),patch.object(qa.time,'sleep'):
            result=qa.wait_export_terminal(device,['사진 원본을 확인하지 못했습니다'],seconds=10)
        self.assertIn('사진 원본을 확인하지 못했습니다',result)
        self.assertEqual(device.dump.call_count,3)

    def test_project_reminder_requires_scroll_to_real_control_not_an_initial_visible_marker(self):
        device=Mock()
        qa.open_project_reminder(device)
        self.assertEqual(device.ready.call_args_list, [call(['QA 데모','기록']), call(['기록 달성률', '촬영 알림'])])
        self.assertEqual(device.tap.call_args_list, [call('통계'),call('프로젝트 촬영 알림 설정',search='below')])

    def test_expected_native_failures_must_not_change_videos_or_guest_quota(self):
        before={'travel-frame.videos.v1':'[]'}
        self.assertTrue(qa.no_export_side_effects(before,dict(before))['guestQuotaUnchanged'])
        for after in [dict(before,guestWeeklyVideoExportUsage='{"count":1}'),{'travel-frame.videos.v1':'[{"id":"unexpected"}]'}]:
            with self.assertRaises(ValueError):qa.no_export_side_effects(before,after)

    def test_declared_frame_count_cannot_replace_counted_decoded_frames(self):
        with self.assertRaises(ValueError):
            qa.validate_video_probe({'streams':[{'codec_type':'video','codec_name':'h264','width':1080,'height':1440,'nb_frames':'9'}],'format':{'duration':'0.3'}})

    def test_export_action_never_falls_back_to_nonclickable_containing_header(self):
        header='<hierarchy><node clickable="false" enabled="true" bounds="[0,0][720,1600]"><node text="변화 영상 만들기" clickable="false" enabled="true" bounds="[140,84][580,188]"/></node></hierarchy>'
        with self.assertRaises(RuntimeError):qa.target_bounds(header,'영상 만들기')
        valid=header.replace('</hierarchy>','<node content-desc="영상 만들기" clickable="true" enabled="true" bounds="[32,1200][688,1296]"/></hierarchy>')
        self.assertEqual(qa.target_bounds(valid,'영상 만들기',viewport=(0,48,720,1504)),(360,1248))

    def test_action_rejects_nonactionable_exact_label_disabled_ancestor_and_offscreen_bounds(self):
        for content in ['<node text="영상 만들기" clickable="false" enabled="true" bounds="[0,0][100,100]"/>',
                        '<node clickable="true" enabled="false" bounds="[0,0][100,100]"><node text="영상 만들기" enabled="true" bounds="[1,1][99,99]"/></node>',
                        '<node content-desc="영상 만들기" clickable="true" enabled="true" bounds="[10,1550][600,1700]"/>']:
            with self.assertRaises(RuntimeError):qa.target_bounds('<hierarchy>'+content+'</hierarchy>','영상 만들기',viewport=(0,48,720,1504))

    def test_summary_accessibility_labels_require_explicit_field_matching(self):
        xml='<hierarchy><node content-desc="사진 간격, 0.1초  ›" clickable="true" enabled="true" bounds="[20,100][700,196]"/></hierarchy>'
        with self.assertRaises(RuntimeError):qa.target_bounds(xml,'사진 간격')
        self.assertEqual(qa.target_bounds(xml,'사진 간격',match='summary'),(360,148))

    def test_modal_action_retries_one_missed_tap_only_after_absent_postcondition(self):
        absent='<hierarchy><node text="page"/></hierarchy>'
        present='<hierarchy><node text="MODAL"/></hierarchy>'
        device=qa.Device();device.dump=Mock(side_effect=[absent,absent,absent]);device.tap=Mock()
        device.ready=Mock(side_effect=[RuntimeError('first tap missed'),present])
        self.assertEqual(device.open_control('settings',['MODAL']),present)
        self.assertEqual(device.tap.call_count,2)

    def test_modal_action_does_not_repeat_if_postcondition_appears_after_timeout(self):
        absent='<hierarchy><node text="page"/></hierarchy>'
        present='<hierarchy><node text="MODAL"/></hierarchy>'
        device=qa.Device();device.dump=Mock(side_effect=[absent,present]);device.tap=Mock()
        device.ready=Mock(side_effect=RuntimeError('animation delayed'))
        self.assertEqual(device.open_control('settings',['MODAL']),present)
        self.assertEqual(device.tap.call_count,1)

    def test_focused_input_is_cleared_with_move_end_and_forty_delete_events(self):
        initial='<hierarchy><node class="android.widget.EditText" focused="true" text="새 프로젝트"/></hierarchy>'
        exact='<hierarchy><node class="android.widget.EditText" focused="true" text="QA_keyboard_large_font"/></hierarchy>'
        device=Mock();device.dump=Mock(side_effect=[initial,exact])
        result=qa.replace_focused_input(device,'QA_keyboard_large_font')
        self.assertTrue(result['inputExactlySet'])
        self.assertEqual(device.shell.call_args_list[0].args,('input','keyevent','KEYCODE_MOVE_END'))
        self.assertEqual(device.shell.call_args_list[1].args,('input','keyevent',*(['KEYCODE_DEL']*40)))
        self.assertEqual(device.shell.call_args_list[2].args,('input','text','QA_keyboard_large_font'))

    def test_focused_input_rejects_retained_default_prefix(self):
        xml='<hierarchy><node class="android.widget.EditText" focused="true" text="새 프로젝트QA_keyboard_large_font"/></hierarchy>'
        device=Mock();device.dump=Mock(return_value=xml)
        with self.assertRaises(RuntimeError):qa.replace_focused_input(device,'QA_keyboard_large_font')

    def test_creation_submission_requires_exact_persisted_name(self):
        import json
        device=Mock();device.storage.return_value={'body-frame.projects.v1':json.dumps([{'name':'새 프로젝트QA_keyboard_large_font'}])}
        with patch.object(qa,'record_ime_visibility',return_value={'visible':True,'source':'window-insets'}):
            with self.assertRaisesRegex(RuntimeError,'did not persist'):qa.creation_submit(device)
        device.activate.assert_called_once_with('프로젝트 만들기',prequery=False)

    def test_viewport_uses_observed_gesture_bar_instead_of_three_button_assumption(self):
        state='InsetsSource: {mType=statusBars mFrame=[0,0][720,48] mVisible=true}\nInsetsSource: {mType=navigationBars mFrame=[0,1552][720,1600] mVisible=true}'
        self.assertEqual(qa.usable_viewport(720,1600,320,state),(0,48,720,1552))
        xml='<hierarchy><node content-desc="적용" clickable="true" enabled="true" bounds="[372,1456][688,1552]"/></hierarchy>'
        self.assertEqual(qa.target_bounds(xml,'적용',viewport=qa.usable_viewport(720,1600,320,state)),(530,1504))

    def test_fresh_muxer_gate_requires_marker_current_pid_and_fresh_ready_sequence(self):
        line=lambda pid,tag,text:f'11-03 03:45:26.264 {pid} 9744 D {tag}: {text}\n'
        old=line(8522,'ViewRecorder','Session vr_1_same ready')+line(8522,'ViewRecorder','Muxer started for session vr_1_same')
        marker=line(9999,'BodyFrameQA','UNIQUE_BEGIN')
        fresh=line(8522,'CCodec','allocate(c2.android.avc.encoder)')+line(8522,'ViewRecorder','Session vr_1_same ready')+line(8522,'ViewRecorder','Muxer started for session vr_1_same')
        self.assertIsNone(qa.fresh_muxer_evidence(old+marker,8522,'UNIQUE_BEGIN'))
        self.assertEqual(qa.fresh_muxer_evidence(old+marker+fresh,8522,'UNIQUE_BEGIN')['session'],'vr_1_same')
        self.assertIsNone(qa.fresh_muxer_evidence(marker+fresh,1234,'UNIQUE_BEGIN'))
        self.assertIsNone(qa.fresh_muxer_evidence(marker+fresh+line(8522,'ViewRecorder','Finishing session vr_1_same (90 frames)'),8522,'UNIQUE_BEGIN'))

    def test_native_option_footer_must_be_fully_visible_and_scroll_container_present(self):
        xml='<hierarchy><node class="android.widget.ScrollView" package="com.haebi.photoguide"/><node content-desc="취소" clickable="true" enabled="true" bounds="[32,1456][348,1552]"/><node content-desc="적용" clickable="true" enabled="true" bounds="[372,1456][688,1552]"/></hierarchy>'
        self.assertTrue(qa.option_sheet_evidence(xml,(0,48,720,1552))['footerFullyVisible'])
        with self.assertRaises(RuntimeError):qa.option_sheet_evidence(xml.replace('[372,1456][688,1552]','[372,1563][688,1600]'),(0,48,720,1552))

    def test_camera_header_hint_must_not_overlap_project_progress(self):
        old='<hierarchy><node text="3 / 100 · 0.3초" bounds="[162,162][558,232]"/><node text="오늘 4번째 기록" bounds="[282,190][437,224]"/></hierarchy>'
        with self.assertRaises(RuntimeError):qa.camera_header_evidence(old)
        self.assertTrue(qa.camera_header_evidence(old.replace('[282,190][437,224]','[282,240][437,274]'))['disjoint'])

    def test_no_scrollable_content_never_swipes_a_dismissing_modal_backdrop(self):
        device=qa.Device();device.dump=Mock(return_value='<hierarchy><node clickable="true" bounds="[0,0][720,1600]"/></hierarchy>');device.shell=Mock()
        self.assertFalse(device.scroll_down())
        device.shell.assert_not_called()

    def test_submission_records_actual_ime_before_after_without_back_or_drag_and_requires_persistence(self):
        import json
        device=Mock()
        device.storage.return_value={'body-frame.projects.v1':json.dumps([{'id':'created','name':'QA_keyboard_large_font'}])}
        before={'visible':True,'source':'window-insets'};after={'visible':False,'source':'window-insets'}
        with patch.object(qa,'record_ime_visibility',side_effect=[before,after]) as observe:
            evidence=qa.creation_submit(device)
        self.assertTrue(evidence['projectPersisted']);self.assertFalse(evidence['keyboardDismissedForSubmit'])
        self.assertTrue(evidence['keyboardVisibleBeforeActivation'])
        self.assertEqual(evidence['imeVisibilityEvidence'],{'before':before,'after':after})
        self.assertEqual([call.args for call in observe.call_args_list],[(device,'submit-keyboard-before'),(device,'submit-keyboard-after')])
        device.activate.assert_called_once_with('프로젝트 만들기',prequery=False);device.shell.assert_not_called()
        device.ready.assert_called_once_with(['QA_keyboard_large_font 프로젝트 열기'])

    def test_background_tap_occurs_only_after_monitor_acknowledges_marker(self):
        device=Mock();events=[]
        def acknowledge(*args,**kwargs):
            device.shell.assert_not_called();events.append('marker-observed');return {'markerObserved':True}
        device.shell.side_effect=lambda *args,**kwargs:events.append('tap')
        with patch.object(qa,'await_log_marker',side_effect=acknowledge):
            _,ack=qa.begin_monitored_export(device,Mock(),bytearray(),'unique-marker',10,20)
        self.assertEqual(events,['marker-observed','tap']);self.assertTrue(ack['markerObserved'])
        device.shell.assert_called_once_with('input','tap',10,20)

    def test_missing_marker_never_injects_export_tap(self):
        device=Mock()
        with patch.object(qa,'await_log_marker',side_effect=RuntimeError('marker acknowledgement timed out')):
            with self.assertRaises(RuntimeError):qa.begin_monitored_export(device,Mock(),bytearray(),'unique-marker',10,20)
        device.shell.assert_not_called()


class CaptureScenarioTest(unittest.TestCase):
    def run_scenario(self, scenario=None):
        import json
        device=Mock()
        device.shell.side_effect=lambda *args,**kwargs:'1' if args==('getprop','ro.kernel.qemu') else ''
        device.dump.return_value='<hierarchy />'
        device.run.return_value=''
        calls=[]
        def capture(_device,directory,name,route,expected,action=None,open_route=True):
            calls.append((directory.name,name,action,open_route))
            return dict(profile=directory.name,screen=name,status='captured')
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);apk=root/'reviewed.apk';apk.write_bytes(b'APK test')
            trust=root/'trust.json';trust.write_text(json.dumps({'clientMatch':True,'apkSha256':'exact-reviewed-hash'}))
            argv=['capture-android-qa.py','--apk',str(apk),'--output',str(root/'captures'),'--trust-manifest',str(trust)]
            if scenario is not None:argv+=['--scenario',scenario]
            with patch('sys.argv',argv),patch.object(qa,'Device',return_value=device),patch.object(qa,'capture',side_effect=capture),patch.object(qa,'prepare_native_hierarchy',return_value={'backend':'native-no-idle'}) as hierarchy,patch.object(qa,'fixture_jpeg',return_value=b'JPEG') as fixtures,patch.object(qa.time,'sleep'),patch.object(qa,'video_failure_and_background_smoke',return_value=[]) as failures,patch.object(qa,'video_smoke',return_value=[]) as videos:
                qa.main()
                manifest=json.loads((root/'captures/capture-manifest.json').read_text())
                files=sorted(str(path.relative_to(root/'captures')) for path in (root/'captures').rglob('*') if path.is_file())
            return manifest,calls,device,fixtures.call_count,failures.call_count,videos.call_count,files

    def test_keyboard_scenario_captures_only_both_large_font_creation_actions(self):
        manifest,calls,device,fixtures,failures,videos,files=self.run_scenario('keyboard')
        expected=[(profile,name,action,open_route) for profile,_,_ in qa.PROFILES for name,action,open_route in [
            ('create-project-large-font-keyboard',qa.creation_keyboard,True),
            ('create-project-large-font-submitted',qa.creation_submit,False)]]
        self.assertEqual(calls,expected)
        self.assertEqual(manifest['hierarchyBackend']['backend'],'native-no-idle')
        self.assertEqual(manifest['scenario'],'keyboard');self.assertEqual(manifest['captured'],4);self.assertEqual(manifest['failed'],0)
        self.assertEqual(manifest['apkTrust'],{'clientMatch':True,'apkSha256':'exact-reviewed-hash'})
        self.assertEqual([call.args for call in device.seed.call_args_list],[(False,'large'),(False,'large')])
        self.assertEqual((fixtures,failures,videos),(0,0,0),'keyboard-only capture must not generate media fixtures or run video acceptance/quota work')
        device.storage.assert_not_called()
        self.assertEqual(sum(call.args==('settings','put','system','font_scale','1.3') for call in device.shell.call_args_list),2)
        self.assertIn('mobile/device.txt',files);self.assertIn('tablet/device.txt',files)
        device.run.assert_any_call('install','-r','-g',unittest.mock.ANY)
        device.shell.assert_any_call('svc','wifi','disable');device.shell.assert_any_call('svc','data','disable')

    def test_default_all_matches_explicit_all_existing_capture_flow(self):
        default=self.run_scenario();explicit=self.run_scenario('all')
        self.assertEqual(default[1],explicit[1]);self.assertEqual(default[3:6],(6,2,2))
        self.assertEqual([call.args for call in default[2].seed.call_args_list],[call.args for call in explicit[2].seed.call_args_list])
        self.assertEqual(default[1][0][1],'create-project')
        self.assertIn(('mobile','camera',None,True),default[1]);self.assertIn(('tablet','video-create',None,True),default[1])

    def test_unknown_scenario_is_rejected_before_device_or_fixture_access(self):
        import contextlib
        import io
        with contextlib.redirect_stderr(io.StringIO()),patch('sys.argv',['capture-android-qa.py','--apk','missing.apk','--output','unused','--scenario','keyboard;invalid']),patch.object(qa,'Device') as device,patch.object(qa,'fixture_jpeg') as fixtures:
            with self.assertRaises(SystemExit):qa.main()
        device.assert_not_called();fixtures.assert_not_called()

    def test_workflow_selection_validates_scenario_before_authenticated_build_calls(self):
        import json
        import subprocess
        import textwrap
        workflow=(Path(__file__).parents[1]/'.github/workflows/body-frame-device-recapture.yml').read_text()
        script=textwrap.dedent(workflow.split('          script: |\n',1)[1].split('      - uses: actions/download-artifact',1)[0])
        harness="""
const {script,selection,env={}}=JSON.parse(process.argv[1]);
const outputs={};let authenticatedCalls=0;
const run=new(require('node:vm').Script)(`(async function(require,process,core,github,context){${script} })`).runInThisContext();
const files={existsSync:()=>true,readFileSync:()=>JSON.stringify(selection),mkdirSync:()=>{},writeFileSync:()=>{}};
const actions={getWorkflowRun:async()=>{authenticatedCalls++;return {data:{repository:{full_name:'owner/repo'},html_url:'https://example.invalid/run',head_sha:'a'.repeat(40)}};},listJobsForWorkflowRun:async()=>({data:{jobs:[{name:'build-apk',conclusion:'success',id:1}]}}),downloadJobLogsForWorkflowRun:async()=>({data:'git log -1 --format=%H\\n'+ 'b'.repeat(40)})};
run(()=>files,{env},{setOutput:(key,value)=>outputs[key]=value},{rest:{actions}},{repo:{owner:'owner',repo:'repo'}}).then(()=>console.log(JSON.stringify({outputs,authenticatedCalls}))).catch(error=>console.log(JSON.stringify({error:error.message,authenticatedCalls})));
"""
        base={'apk_run_id':123,'apk_sha256':'a'*64}
        for value,expected in [(None,'all'),('all','all'),('keyboard','keyboard'),('keyboard; echo unsafe',None),('',None),([],None)]:
            selection=dict(base)
            if value is not None:selection['capture_scenario']=value
            result=subprocess.run(['node','-e',harness,json.dumps(dict(script=script,selection=selection))],capture_output=True,text=True,check=True)
            data=json.loads(result.stdout)
            if expected is None:self.assertIn('capture scenario',data['error']);self.assertEqual(data['authenticatedCalls'],0)
            else:self.assertEqual(data['outputs']['capture_scenario'],expected);self.assertEqual(data['authenticatedCalls'],1)
        for scenario in ['all','keyboard','keyboard; echo unsafe']:
            env={'APK_RUN_ID':'123','APK_SHA256':'a'*64,'CAPTURE_SCENARIO':scenario}
            result=subprocess.run(['node','-e',harness,json.dumps(dict(script=script,selection={},env=env))],capture_output=True,text=True,check=True)
            data=json.loads(result.stdout)
            if scenario in ['all','keyboard']:self.assertEqual(data['outputs']['capture_scenario'],scenario)
            else:self.assertEqual(data['authenticatedCalls'],0);self.assertIn('capture scenario',data['error'])
        self.assertIn('--scenario "$CAPTURE_SCENARIO"',workflow)
        self.assertIn('CAPTURE_SCENARIO: ${{ steps.selected.outputs.capture_scenario }}',workflow)


class KnownBelowSearchTest(unittest.TestCase):
    def test_known_below_submit_search_keeps_scrolling_down_past_generic_three_swipe_limit(self):
        absent='<hierarchy><node text="form"/></hierarchy>'
        present='<hierarchy><node content-desc="프로젝트 만들기" clickable="true" enabled="true" bounds="[32,800][688,896]"/></hierarchy>'
        device=qa.Device();device.viewport=Mock(return_value=(0,48,720,1552));device.dump=Mock(side_effect=[absent]*5+[present])
        device.scroll_down=Mock(return_value=True);device.search_snapshot=Mock(return_value=None)
        self.assertEqual(device.find_control('프로젝트 만들기',search='below'),(360,848))
        self.assertEqual(device.scroll_down.call_count,5)
        self.assertTrue(all(call.kwargs=={'reverse':False} for call in device.scroll_down.call_args_list))

    def test_known_below_search_reverses_only_for_explicit_above_viewport_evidence(self):
        above='<hierarchy><node content-desc="프로젝트 만들기" clickable="true" enabled="true" bounds="[32,0][688,43]"/></hierarchy>'
        visible=above.replace('[32,0][688,43]','[32,100][688,196]')
        device=qa.Device();device.viewport=Mock(return_value=(0,48,720,1552));device.dump=Mock(side_effect=[above,visible]);device.scroll_down=Mock(return_value=True);device.search_snapshot=Mock(return_value=None)
        self.assertEqual(device.find_control('프로젝트 만들기',search='below'),(360,148));device.scroll_down.assert_called_once_with(reverse=True)

    def test_known_below_diagnostic_writes_neutral_step_png_xml_and_json(self):
        with tempfile.TemporaryDirectory() as temp:
            device=qa.Device();device.capture_directory=Path(temp);device.search_diagnostics=[]
            device.run=Mock(return_value=b'\x89PNG\r\n\x1a\n'+b'fixture')
            record=device.search_snapshot('프로젝트 만들기',0,'<hierarchy/>',(0,48,720,1552),'searching')
            folder=Path(temp)/'diagnostics/project-submit-search'
            self.assertTrue(all((folder/('step-00.'+suffix)).exists() for suffix in ['png','xml','json']))
            self.assertNotIn('failure',record['png']);self.assertEqual(record['state'],'searching')


class ImeVisibilityTest(unittest.TestCase):
    def test_hidden_window_source_overrides_stale_requested_input_flags(self):
        state=qa.actual_ime_visibility('InsetsSource: {mType=ime mVisible=false}', 'mInputShown=true isInputViewShown=true')
        self.assertIs(state['visible'],False)
        self.assertEqual(state['source'],'WindowManager.InsetsSource.ime')

    def test_verified_actual_status_bit_fallback_distinguishes_active_from_visible(self):
        self.assertIs(qa.actual_ime_visibility('', 'mInputShown=true mImeWindowVis=0x1')['visible'],False)
        self.assertIs(qa.actual_ime_visibility('', 'mInputShown=false mImeWindowVis=0x3')['visible'],True)

    def test_absent_actual_fields_never_turn_requested_false_into_hidden_proof(self):
        self.assertIsNone(qa.actual_ime_visibility('', 'mInputShown=false')['visible'])

    def test_guard_accepts_real_hide_even_while_requested_flag_stays_true(self):
        state={'visible':True};device=qa.Device()
        def shell(*args,**kwargs):
            if args==('input','keyevent','KEYCODE_BACK'):state['visible']=False;return ''
            if args==('dumpsys','window','displays'):return 'InsetsSource: {mType=ime mVisible='+str(state['visible']).lower()+'}'
            if args==('dumpsys','input_method'):return 'mInputShown=true mImeWindowVis='+('0x3' if state['visible'] else '0x1')
            return ''
        device.shell=Mock(side_effect=shell)
        evidence=qa.ensure_keyboard_hidden(device)
        self.assertTrue(evidence['hiddenConfirmed']);self.assertTrue(evidence['keyboardWasShown'])
        self.assertEqual(sum(call.args==('input','keyevent','KEYCODE_BACK') for call in device.shell.call_args_list),1)

    def test_unknown_actual_visibility_fails_before_back(self):
        device=qa.Device();device.shell=Mock(return_value='mInputShown=false')
        with self.assertRaises(RuntimeError):qa.ensure_keyboard_hidden(device)
        self.assertFalse(any(call.args==('input','keyevent','KEYCODE_BACK') for call in device.shell.call_args_list))


class FreshHierarchyTest(unittest.TestCase):
    def test_legacy_exit_zero_without_dump_ack_never_reads_any_old_xml(self):
        device=qa.Device();device.shell=Mock(return_value='');device.run=Mock(return_value='<hierarchy/>')
        with self.assertRaises(RuntimeError):device.dump()
        device.run.assert_not_called()

    def test_fresh_native_output_requires_exact_ack_for_unique_path(self):
        device=qa.Device();device.native_hierarchy_jar='/data/local/tmp/qa.jar'
        def shell(*args,**kwargs):
            if args and args[0]=='env':return 'BODY_FRAME_QA_HIERARCHY_DUMPED '+args[-1]
            return ''
        device.shell=Mock(side_effect=shell);device.run=Mock(return_value='<hierarchy><node text="fresh"/></hierarchy>')
        self.assertIn('fresh',device.dump());self.assertIn('fresh',device.dump())
        paths=[call.args[-1] for call in device.shell.call_args_list if call.args[0]=='env']
        self.assertEqual(len(set(paths)),2)
        self.assertTrue(all('/data/local/tmp/body-frame-qa-' in path for path in paths))
        self.assertTrue(all(call.args[:5]==('env','CLASSPATH=/data/local/tmp/qa.jar','app_process','/system/bin','BodyFrameQaHierarchy') for call in device.shell.call_args_list if call.args[0]=='env'))

    def test_native_ack_for_different_path_is_rejected_without_read(self):
        device=qa.Device();device.native_hierarchy_jar='/data/local/tmp/qa.jar'
        device.shell=Mock(return_value='BODY_FRAME_QA_HIERARCHY_DUMPED /sdcard/old.xml');device.run=Mock()
        with self.assertRaises(RuntimeError):device.dump()
        device.run.assert_not_called()


def native_click_fixture(device, attributes, screenshot=None):
    import base64
    png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6CwoAAAAASUVORK5CYII=') if screenshot is None else screenshot
    state={}
    def shell(*args,**kwargs):
        if args[0]=='env':state['target']=args[5];return 'BODY_FRAME_QA_HIERARCHY_CLICKED '+args[5]
        return ''
    def read(*args,**kwargs):
        if kwargs.get('binary'):return png
        return '<hierarchy action="accessibility-click" requested-click-label="프로젝트 만들기" preclick-screenshot-path="'+state['target']+'.preclick.png" preclick-screenshot-at-ms="123" activation-policy="strict-full-visible" '+attributes+'/>'
    device.shell=Mock(side_effect=shell);device.run=Mock(side_effect=read)


class NativePreclickEvidenceTest(unittest.TestCase):
    def test_native_preclick_png_is_retained_with_hash_dimensions_and_explicit_visual_gate(self):
        with tempfile.TemporaryDirectory() as temp:
            device=qa.Device();device.capture_directory=Path(temp);device.native_hierarchy_jar='/data/local/tmp/qa.jar'
            native_click_fixture(device,'click-action-count="1" show-on-screen-action-count="0"')
            device.dump(click_label='프로젝트 만들기')
            record=device.last_hierarchy_evidence['preclickScreenshot']
            self.assertEqual([record['width'],record['height']],[1,1]);self.assertTrue(record['requiresVisualReview'])
            self.assertEqual(qa.hashlib.sha256((Path(temp)/record['png']).read_bytes()).hexdigest(),record['sha256'])
            self.assertEqual(record['activationPolicy'],'strict-full-visible')

    def test_failed_native_action_retains_connected_png_without_claiming_ack(self):
        import json
        with tempfile.TemporaryDirectory() as temp:
            device=qa.Device();device.capture_directory=Path(temp);device.native_hierarchy_jar='/data/local/tmp/qa.jar'
            native_click_fixture(device,'click-action-count="1" show-on-screen-action-count="0"')
            original=device.shell.side_effect
            def shell(*args,**kwargs):
                result=original(*args,**kwargs)
                if args[0]=='env':raise RuntimeError('Native ACTION_CLICK returned false')
                return result
            device.shell.side_effect=shell
            with self.assertRaisesRegex(RuntimeError,'returned false'):device.dump(click_label='프로젝트 만들기')
            record=json.loads(next((Path(temp)/'diagnostics/hierarchy-dumps').glob('dump-*.json')).read_text())
            self.assertFalse(record['acknowledged']);self.assertNotIn('nativeActionCount',record)
            self.assertTrue((Path(temp)/record['unacknowledgedPreclickScreenshot']['png']).exists())

    def test_ack_without_valid_native_preclick_png_fails_closed(self):
        device=qa.Device();device.native_hierarchy_jar='/data/local/tmp/qa.jar'
        native_click_fixture(device,'click-action-count="1"',screenshot=b'not png')
        with self.assertRaisesRegex(RuntimeError,'preclick.*PNG'):device.dump(click_label='프로젝트 만들기')


class NativeActivationTest(unittest.TestCase):
    def test_semantic_activation_uses_one_exact_native_click_request_without_coordinate_tap(self):
        device=qa.Device();device.native_hierarchy_jar='/data/local/tmp/qa.jar';device.find_control=Mock(return_value=(360,1470))
        native_click_fixture(device,'click-target-bounds="[34,1422][686,1518]" click-action-count="1"')
        result=device.activate('프로젝트 만들기',search='below')
        self.assertEqual(result['nativeActionCount'],1)
        calls=[call.args for call in device.shell.call_args_list if call.args[0]=='env']
        self.assertEqual(len(calls),1);self.assertEqual(calls[0][-2:],('--click-label','프로젝트 만들기'))
        self.assertFalse(any(call.args[:2]==('input','tap') for call in device.shell.call_args_list))

    def test_direct_semantic_activation_never_queries_or_physically_scrolls(self):
        device=qa.Device();device.native_hierarchy_jar='/data/local/tmp/qa.jar';device.find_control=Mock()
        native_click_fixture(device,'click-action-count="1" show-on-screen-action-count="1"')
        result=device.activate('프로젝트 만들기',prequery=False)
        device.find_control.assert_not_called()
        self.assertIsNone(result['prequeryPoint']);self.assertEqual(result['physicalPrequeryActionCount'],0)
        self.assertFalse(any(call.args[0]=='input' for call in device.shell.call_args_list))

    def test_semantic_activation_has_no_legacy_or_coordinate_fallback(self):
        device=qa.Device();device.shell=Mock();device.find_control=Mock()
        with self.assertRaises(RuntimeError):device.activate('프로젝트 만들기',search='below')
        device.shell.assert_not_called();device.find_control.assert_not_called()

    def test_direct_keyboard_submission_rejects_hidden_or_unknown_actual_ime(self):
        for visible in (False,None):
            device=Mock()
            with self.subTest(visible=visible),patch.object(qa,'record_ime_visibility',return_value={'visible':visible}):
                with self.assertRaisesRegex(RuntimeError,'must remain visible'):qa.creation_submit(device)
            device.activate.assert_not_called();device.shell.assert_not_called()

    def test_submission_activates_once_then_requires_exact_ui_and_persistence(self):
        import json
        device=Mock();device.activate.return_value={'nativeActionCount':1}
        device.storage.return_value={'body-frame.projects.v1':json.dumps([{'id':'created','name':'QA_keyboard_large_font'}])}
        with patch.object(qa,'record_ime_visibility',return_value={'visible':True,'source':'window-insets'}):result=qa.creation_submit(device)
        device.activate.assert_called_once_with('프로젝트 만들기',prequery=False);device.tap.assert_not_called();device.shell.assert_not_called()
        device.ready.assert_any_call(['QA_keyboard_large_font 프로젝트 열기'])
        self.assertTrue(result['projectPersisted']);self.assertEqual(result['submitActivation']['nativeActionCount'],1)
        self.assertEqual(result['physicalBackActionCount'],0);self.assertEqual(result['physicalDragActionCount'],0)


class NativeActionFailureEvidenceTest(unittest.TestCase):
    def test_native_guard_failure_preserves_xml_before_cleanup_without_ack_or_success_count(self):
        import json
        with tempfile.TemporaryDirectory() as temp:
            device=qa.Device();device.capture_directory=Path(temp);device.native_hierarchy_jar='/data/local/tmp/qa.jar';events=[]
            def shell(*args,**kwargs):
                if args[0]=='env':raise RuntimeError('Unique target count0')
                if args[0]=='rm':events.append('remove')
                return ''
            def read(*args,**kwargs):
                if kwargs.get('binary'):return b''
                events.append('preserve');return '<hierarchy candidate-count="0"/>'
            device.shell=Mock(side_effect=shell);device.run=Mock(side_effect=read)
            with self.assertRaises(RuntimeError):device.dump(click_label='프로젝트 만들기')
            folder=Path(temp)/'diagnostics/hierarchy-dumps'
            xml=next(folder.glob('*.unacknowledged.xml'));self.assertIn('candidate-count="0"',xml.read_text())
            record=json.loads(next(folder.glob('dump-*.json')).read_text())
            self.assertFalse(record['acknowledged']);self.assertNotIn('nativeActionCount',record)
            self.assertEqual(events,['remove','preserve','remove'])

    def test_native_show_action_count_is_separate_from_single_click_ack(self):
        device=qa.Device();device.native_hierarchy_jar='/data/local/tmp/qa.jar';device.find_control=Mock(return_value=(360,1470))
        native_click_fixture(device,'show-on-screen-action-count="1" click-action-count="1"')
        result=device.activate('프로젝트 만들기',search='below')
        self.assertEqual(result['nativeClickActionCount'],1);self.assertEqual(result['nativeShowOnScreenActionCount'],1)


    def test_success_ack_requires_recorded_exactly_one_click(self):
        for count in ('0','2',None):
            device=qa.Device();device.native_hierarchy_jar='/data/local/tmp/qa.jar'
            device.shell=Mock(side_effect=lambda *args,**kwargs:'BODY_FRAME_QA_HIERARCHY_CLICKED '+args[5] if args[0]=='env' else '')
            attr='' if count is None else ' click-action-count="'+count+'"'
            device.run=Mock(return_value='<hierarchy action="accessibility-click" requested-click-label="프로젝트 만들기"'+attr+'/>')
            with self.subTest(count=count),self.assertRaisesRegex(RuntimeError,'exactly one click'):device.dump(click_label='프로젝트 만들기')


class NativeAcquisitionSnapshotTest(unittest.TestCase):
    def test_failed_native_action_archives_each_attempt_before_remote_cleanup(self):
        import json
        with tempfile.TemporaryDirectory() as temp:
            device=qa.Device();device.capture_directory=Path(temp);device.native_hierarchy_jar='/data/local/tmp/qa.jar';state={};events=[]
            def shell(*args,**kwargs):
                if args[0]=='env':state['target']=args[5];raise RuntimeError('Unique target count0')
                if args[0]=='find':return state['target']+'.attempt-1.xml'
                if args[0]=='rm':events.append(('remove',args[-1]))
                return ''
            def read(*args,**kwargs):events.append(('read',args[-1]));return '<hierarchy candidate-count="0" acquisition-attempts="1"/>'
            device.shell=Mock(side_effect=shell);device.run=Mock(side_effect=read)
            with self.assertRaises(RuntimeError):device.dump(click_label='프로젝트 만들기')
            folder=Path(temp)/'diagnostics/hierarchy-dumps';record=json.loads(next(folder.glob('dump-*.json')).read_text())
            snapshot=record['acquisitionSnapshots'][0]
            self.assertTrue((Path(temp)/snapshot['xml']).exists());self.assertFalse(record['acknowledged'])
            remote=state['target']+'.attempt-1.xml'
            self.assertLess(events.index(('read',remote)),events.index(('remove',remote)))


if __name__ == '__main__':
    unittest.main()
