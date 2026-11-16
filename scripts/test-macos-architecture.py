import importlib.util
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location('mac_architecture', Path(__file__).with_name('verify-macos-architecture.py'))
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class ArchitectureContractTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name) / 'AiRC.app'
        self.arches = {}

    def add_component(self, name, architecture):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(bytes.fromhex('cffaedfe') + bytes(28))
        self.arches[path.resolve()] = [architecture]
        return path

    def prepare(self, architecture):
        for name in policy.CRITICAL_COMPONENTS:
            self.add_component(name, architecture)
        for label, native in [('darwin-arm64', 'arm64'), ('darwin-x64', 'x86_64')]:
            for name in ['pty.node', 'spawn-helper']:
                self.add_component('/'.join(policy.PTY_PREFIX + (label, name)), native)

    def inspect(self, path):
        return self.arches[path.resolve()]

    def test_both_releases_accept_correctly_labeled_terminal_prebuilds(self):
        for architecture in ['arm64', 'x86_64']:
            self.prepare(architecture)
            self.assertEqual(policy.verify(self.root, architecture, self.inspect), (8, 2))

    def test_wrong_main_architecture_is_rejected(self):
        self.prepare('arm64')
        self.add_component('Contents/MacOS/airc', 'x86_64')
        with self.assertRaisesRegex(ValueError, 'Architecture mismatch'):
            policy.verify(self.root, 'arm64', self.inspect)

    def test_mislabeled_alternate_prebuild_is_rejected(self):
        self.prepare('arm64')
        self.add_component('/'.join(policy.PTY_PREFIX + ('darwin-x64', 'pty.node')), 'arm64')
        with self.assertRaisesRegex(ValueError, 'Architecture mismatch'):
            policy.verify(self.root, 'arm64', self.inspect)

    def test_alternate_exception_does_not_apply_to_other_libraries(self):
        self.prepare('arm64')
        self.add_component('Contents/Frameworks/prebuilds/darwin-x64/pty.node', 'x86_64')
        with self.assertRaisesRegex(ValueError, 'Architecture mismatch'):
            policy.verify(self.root, 'arm64', self.inspect)

    def test_missing_core_is_rejected_even_with_many_prebuilds(self):
        self.prepare('arm64')
        (self.root / 'Contents/Resources/bin/airc').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing native runtime'):
            policy.verify(self.root, 'arm64', self.inspect)

    def test_core_cannot_escape_the_application(self):
        self.prepare('arm64')
        path = self.root / 'Contents/Resources/bin/airc'
        path.unlink()
        outside = self.root.parent / 'outside'
        outside.write_bytes(bytes.fromhex('cffaedfe') + bytes(28))
        path.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'escapes the application'):
            policy.verify(self.root, 'arm64', self.inspect)


if __name__ == '__main__':
    unittest.main()
