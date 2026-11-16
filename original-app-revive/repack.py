# Rebuilds the original APK with a replaced JS bundle and no old signature (sign afterwards).
# Usage: python -I repack.py <original.apk> <patched index.android.bundle> <out-unsigned.apk>
import sys
import zipfile

src_apk, bundle_path, out_apk = sys.argv[1:4]
BUNDLE = 'assets/index.android.bundle'


def is_old_signature(name):
    if not name.startswith('META-INF/'):
        return False
    upper = name.upper()
    return upper.endswith(('.SF', '.RSA', '.DSA', '.EC')) or upper == 'META-INF/MANIFEST.MF'


with open(bundle_path, 'rb') as f:
    bundle = f.read()

with zipfile.ZipFile(src_apk) as zin, zipfile.ZipFile(out_apk, 'w') as zout:
    for info in zin.infolist():
        if is_old_signature(info.filename):
            continue
        data = bundle if info.filename == BUNDLE else zin.read(info.filename)
        out = zipfile.ZipInfo(info.filename, date_time=info.date_time)
        out.compress_type = info.compress_type
        out.external_attr = info.external_attr
        zout.writestr(out, data)

print('wrote', out_apk)
