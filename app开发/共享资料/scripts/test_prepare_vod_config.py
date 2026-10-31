import json
from pathlib import Path
import tempfile
import unittest
from prepare_vod_config import load_assets

class ClientAssetBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.folder = self.root / 'android'
        self.folder.mkdir()
        self.manifest = {'applicationId':'cn.com.swod.app','licenseKey':'test-only-license','signatureMD5':'460ddea3a2119d0c4f11c43c24889b11'}
        self.write_manifest()
        (self.folder/'AliVideoCert.crt').write_text('TEST ONLY CERTIFICATE')
        (self.folder/'encryptedApp.dat').write_text('TestOnlyEncodedKey_123-abc',encoding='utf-8-sig')
    def tearDown(self):
        self.temp.cleanup()
    def write_manifest(self):
        (self.folder/'license.json').write_text(json.dumps(self.manifest))
    def test_missing_license_keeps_cache_unconfigured(self):
        (self.folder/'license.json').unlink()
        self.assertIsNone(load_assets('android',self.root))
    def test_vendor_text_is_used_without_decoding(self):
        assets = load_assets('android',self.root)
        self.assertEqual(Path(assets['downloadKey']).read_text(encoding='utf-8-sig'),'TestOnlyEncodedKey_123-abc')
    def test_base64_decoded_binary_is_rejected(self):
        (self.folder/'encryptedApp.dat').write_bytes(bytes(range(256)))
        with self.assertRaises(ValueError):load_assets('android',self.root)
    def test_other_android_signature_is_rejected(self):
        self.manifest['signatureMD5']='0'*32
        self.write_manifest()
        with self.assertRaises(ValueError):load_assets('android',self.root)

if __name__ == '__main__':unittest.main()
