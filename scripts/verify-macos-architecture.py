#!/usr/bin/env python3
import os
from pathlib import Path
import subprocess
import sys


CRITICAL_COMPONENTS = (
    'Contents/MacOS/airc',
    'Contents/Resources/bin/airc',
    'Contents/Resources/bin/AiRC Computer Use.app/Contents/MacOS/airc-computer-use',
    'Contents/Frameworks/Electron Framework.framework/Electron Framework',
)
PTY_PREFIX = (
    'Contents', 'Resources', 'app.asar.unpacked', '.vite',
    'node_modules', 'node-pty', 'prebuilds',
)
PREBUILD_ARCHITECTURES = {'darwin-arm64': 'arm64', 'darwin-x64': 'x86_64'}


def component_architecture(relative, selected):
    parts = relative.parts
    if (len(parts) == 9 and parts[:7] == PTY_PREFIX
            and parts[7] in PREBUILD_ARCHITECTURES
            and parts[8] in {'pty.node', 'spawn-helper'}):
        return PREBUILD_ARCHITECTURES[parts[7]]
    return selected


def is_macho(header):
    if header[:4] in [bytes.fromhex(x) for x in ('feedface', 'cefaedfe', 'feedfacf', 'cffaedfe')]:
        return True
    return (header[:4] in [bytes.fromhex('cafebabe'), bytes.fromhex('cafebabf')]
            and 1 <= int.from_bytes(header[4:8], 'big') <= 8)


def lipo_architectures(path):
    return subprocess.check_output(['/usr/bin/lipo', '-archs', str(path)], text=True).split()


def verify(root, selected, inspect=lipo_architectures):
    if selected not in {'arm64', 'x86_64'}:
        raise ValueError('Unsupported macOS architecture')
    root = root.resolve()
    checked = {}
    alternate_prebuilds = 0
    for directory, _, names in os.walk(root, followlinks=False):
        for name in names:
            path = Path(directory) / name
            if path.is_symlink():
                continue
            with path.open('rb') as stream:
                header = stream.read(8)
            if not is_macho(header):
                continue
            relative = path.relative_to(root)
            required = component_architecture(relative, selected)
            arches = inspect(path)
            if required not in arches:
                raise ValueError(f'Architecture mismatch: {relative}; expected {required}, found {arches}')
            checked[relative] = arches
            alternate_prebuilds += required != selected
    for name in CRITICAL_COMPONENTS:
        component = root / name
        if not component.is_file():
            raise ValueError(f'Missing native runtime component: {name}')
        try:
            relative = component.resolve().relative_to(root)
        except ValueError:
            raise ValueError(f'Native runtime component escapes the application: {name}')
        if selected not in checked.get(relative, []):
            raise ValueError(f'Native runtime component does not contain {selected}: {name}')
    return len(checked), alternate_prebuilds


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: verify-macos-architecture.py <AiRC.app> <arm64|x86_64>')
    try:
        count, alternate = verify(Path(sys.argv[1]), sys.argv[2])
    except ValueError as error:
        raise SystemExit(str(error))
    print(f'Verified {count} native components for {sys.argv[2]}; '
          f'{alternate} labeled alternate node-pty prebuilds verified separately')
