#!/usr/bin/env python3
"""Host-only checks for fixture integrity and UI selector interpretation."""
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location('capture_qa', Path(__file__).with_name('capture-android-qa.py'))
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


class CaptureHelpersTest(unittest.TestCase):
    def test_click_uses_clickable_parent_bounds_and_ignores_disabled_control(self):
        xml = '''<hierarchy><node clickable="true" enabled="false" bounds="[0,0][100,100]" content-desc="사진 수"/><node clickable="true" enabled="true" bounds="[10,40][310,100]"><node text="사진 수" enabled="true" bounds="[20,50][70,80]"/></node></hierarchy>'''
        self.assertEqual(qa.target_bounds(xml, '사진 수'), (160, 70))
        with self.assertRaises(RuntimeError):
            qa.target_bounds(xml, '삭제')

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
        device=Mock();device.shell.return_value='mInputShown=false';device.storage.return_value={'body-frame.projects.v1':json.dumps([{'name':'새 프로젝트QA_keyboard_large_font'}])}
        with self.assertRaises(RuntimeError):qa.creation_submit(device)

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

    def test_submission_dismisses_real_keyboard_before_scrolling_and_exact_persistence_check(self):
        import json
        device=Mock();device.shell.side_effect=['mInputShown=true','','mInputShown=false']
        device.storage.return_value={'body-frame.projects.v1':json.dumps([{'id':'created','name':'QA_keyboard_large_font'}])}
        evidence=qa.creation_submit(device)
        self.assertTrue(evidence['projectPersisted']);self.assertTrue(evidence['keyboardDismissedForSubmit'])
        self.assertIn(('input','keyevent','KEYCODE_BACK'),[call.args for call in device.shell.call_args_list])


if __name__ == '__main__':
    unittest.main()
