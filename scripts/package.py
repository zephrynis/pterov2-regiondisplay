from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'extension.json').read_text())
metadata = json.loads((root / 'package.json').read_text())
lock = json.loads((root / 'package-lock.json').read_text())
assert manifest['id'] == root.name == metadata['name']
assert manifest['version'] == metadata['version'] == lock['version']
assert (root / 'dist/client.js').is_file()
assert len(list((root / 'dist').glob('*.svg'))) == 249
output = root / 'release' / f"{manifest['id']}-{manifest['version']}.pteroext"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for name in ['extension.json', 'README.md', 'src', 'routes', 'database', 'resources', 'dist']:
        path = root / name
        for file in ([path] if path.is_file() else sorted(path.rglob('*'))):
            if file.is_file() and not file.is_relative_to(root / 'src/client'):
                archive.write(file, file.relative_to(root))
print(output)

download = output.with_suffix('.zip')
with ZipFile(download, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    archive.write(output, output.name)
    archive.writestr('README.txt', (
        'Thank you for downloading Region Display!\n\n'
        'To install, upload the included .pteroext file in Admin > Extensions,\n'
        'enable Region Display, and reload your browser.\n'
    ))
print(download)
