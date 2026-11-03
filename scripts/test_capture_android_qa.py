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


if __name__ == '__main__':
    unittest.main()
