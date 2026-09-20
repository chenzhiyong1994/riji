"""Verify device architecture and byte-identical offline assets before publication."""
import hashlib
import pathlib
import plistlib
import struct
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
with zipfile.ZipFile(sys.argv[1]) as archive:
    names = archive.namelist()
    assert len(names) == len(set(names)), 'Duplicate ZIP paths'
    assert all(n.startswith('Payload/Riji.app/') and '..' not in n.split('/') for n in names), 'Unexpected ZIP path'
    prefix = 'Payload/Riji.app/'
    info = plistlib.loads(archive.read(prefix + 'Info.plist'))
    assert info['CFBundleIdentifier'] == 'local.jilian.app'
    assert info['CFBundleShortVersionString'] == '1.1.3'
    assert info['MinimumOSVersion'] == '16.0'
    assert info['CFBundleSupportedPlatforms'] == ['iPhoneOS']
    binary = archive.read(prefix + info['CFBundleExecutable'])
    assert binary[:4] == b'\xcf\xfa\xed\xfe', 'Expected a 64-bit Mach-O device binary'
    assert struct.unpack_from('<I', binary, 4)[0] == 0x0100000C, 'Expected ARM64'
    assert not any('_CodeSignature/' in n or n.endswith('embedded.mobileprovision') for n in names), 'Do not publish signing material'
    assets = root / 'app/src/main/assets'
    expected = {p.relative_to(assets).as_posix(): p for p in assets.rglob('*') if p.is_file()}
    actual = {n[len(prefix + 'assets/'):] for n in names if n.startswith(prefix + 'assets/') and not n.endswith('/')}
    assert actual == set(expected), 'Bundled asset inventory differs from source'
    for relative, source in expected.items():
        assert archive.read(prefix + 'assets/' + relative) == source.read_bytes(), relative
    assert archive.read(prefix + 'native-bridge.js') == (root / 'ios/Riji/native-bridge.js').read_bytes()
    assert plistlib.loads(archive.read(prefix + 'PrivacyInfo.xcprivacy'))['NSPrivacyTracking'] is False
    print(f'Validated unsigned ARM64 iOS app with {len(expected)} byte-identical assets.')
print('SHA-256:', hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest())
