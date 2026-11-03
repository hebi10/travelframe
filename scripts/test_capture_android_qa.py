#!/usr/bin/env python3
"""Host-only checks for fixture integrity and UI selector interpretation."""
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest

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


if __name__ == '__main__':
    unittest.main()
