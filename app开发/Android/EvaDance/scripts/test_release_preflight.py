"""Security regression checks for the app-owned exported-component release gate."""
import copy
import unittest
import xml.etree.ElementTree as ET
from release_preflight import PROJECT, NS, source_manifest_check


class ManifestBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.manifest = ET.parse(PROJECT/'app/src/main/AndroidManifest.xml').getroot()

    def test_existing_launcher_and_oem_entry_are_explicit(self):
        self.assertTrue(source_manifest_check(self.manifest)['passed'])

    def test_new_exported_activity_is_rejected(self):
        ET.SubElement(self.manifest.find('application'), 'activity',
                      {NS+'name': '.UnreviewedActivity', NS+'exported': 'true'})
        result = source_manifest_check(self.manifest)
        self.assertFalse(result['passed'])
        self.assertEqual(result['unexpectedExportedActivities'], ['.UnreviewedActivity'])

    def test_exported_alias_cannot_bypass_the_activity_allowlist(self):
        ET.SubElement(self.manifest.find('application'), 'activity-alias',
                      {NS+'name': '.UnreviewedAlias', NS+'targetActivity': '.PlayerActivity', NS+'exported': 'true'})
        self.assertFalse(source_manifest_check(self.manifest)['passed'])

    def test_implicit_export_is_rejected(self):
        ET.SubElement(self.manifest.find('application'), 'activity', {NS+'name': '.ImplicitActivity'})
        self.assertFalse(source_manifest_check(self.manifest)['passed'])

    def test_backup_and_cleartext_flags_remain_enforced(self):
        for flag in ['allowBackup', 'usesCleartextTraffic']:
            with self.subTest(flag=flag):
                manifest = copy.deepcopy(self.manifest)
                manifest.find('application').set(NS+flag, 'true')
                self.assertFalse(source_manifest_check(manifest)['passed'])


if __name__ == '__main__':
    unittest.main()
