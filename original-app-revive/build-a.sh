#!/usr/bin/env bash
# Rebuilds the original Pix Backpack v1.40 APK so it runs without the vendor's servers.
# Usage: ./build-a.sh <original-v1.40.apk> [out.apk]
# Env:   KEYSTORE (default: keys/pix-local.jks next to this script, created if missing)
#        KEY_ALIAS (default: pix)
#        PIX_KS_PASS (keystore password, min 6 chars; prompted if unset)
# Needs node, python3, unzip, zipalign, apksigner, keytool (PATH, or ANDROID_HOME build-tools / JAVA_HOME).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APK="${1:-}"
OUT="${2:-$HERE/out/PixBackpack-1.40-revived.apk}"
KEYSTORE="${KEYSTORE:-$HERE/keys/pix-local.jks}"
KEY_ALIAS="${KEY_ALIAS:-pix}"

if [ -z "$APK" ]; then
  echo "usage: $0 <original-v1.40.apk> [out.apk]" >&2
  exit 1
fi
[ -f "$APK" ] || { echo "APK not found: $APK" >&2; exit 1; }

find_tool() {
  local name="$1"; shift
  if command -v "$name" >/dev/null 2>&1; then command -v "$name"; return 0; fi
  local d
  for d in "$@"; do
    if [ -x "$d/$name" ]; then echo "$d/$name"; return 0; fi
  done
  return 1
}

BUILD_TOOLS=()
for sdk in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}"; do
  if [ -n "$sdk" ] && [ -d "$sdk/build-tools" ]; then
    while IFS= read -r d; do BUILD_TOOLS+=("$d"); done < <(ls -d "$sdk"/build-tools/*/ 2>/dev/null | sort -rV)
  fi
done
JAVA_BIN=()
[ -n "${JAVA_HOME:-}" ] && JAVA_BIN+=("$JAVA_HOME/bin")

need() {
  local var="$1" name="$2" hint="$3"; shift 3
  local p
  if ! p="$(find_tool "$name" "$@")"; then
    echo "$name not found. $hint" >&2
    exit 1
  fi
  printf -v "$var" '%s' "$p"
}

need NODE node "Install Node.js 18+."
need PYTHON python3 "Install Python 3."
need UNZIP unzip "Install unzip."
need ZIPALIGN zipalign "Install Android SDK build-tools and set ANDROID_HOME." ${BUILD_TOOLS[@]+"${BUILD_TOOLS[@]}"}
need APKSIGNER apksigner "Install Android SDK build-tools and set ANDROID_HOME." ${BUILD_TOOLS[@]+"${BUILD_TOOLS[@]}"}
need KEYTOOL keytool "Install a JDK (17+) and set JAVA_HOME." ${JAVA_BIN[@]+"${JAVA_BIN[@]}"}

if [ -z "${PIX_KS_PASS:-}" ]; then
  read -r -s -p "Keystore password (min 6 chars): " PIX_KS_PASS; echo
fi
[ "${#PIX_KS_PASS}" -ge 6 ] || { echo "Keystore password must be at least 6 characters." >&2; exit 1; }
export PIX_KS_PASS

WORK="$HERE/work"
mkdir -p "$WORK" "$(dirname "$OUT")" "$(dirname "$KEYSTORE")"

echo "[1/5] Extracting JS bundle"
"$UNZIP" -p "$APK" assets/index.android.bundle > "$WORK/orig.android.bundle" || {
  echo "assets/index.android.bundle not found. Is this the original Pix Backpack v1.40 APK?" >&2; exit 1; }

echo "[2/5] Patching bundle"
"$NODE" "$HERE/patch-bundle.js" "$WORK/orig.android.bundle" "$WORK/index.android.bundle"

echo "[3/5] Repacking APK"
"$PYTHON" -I "$HERE/repack.py" "$APK" "$WORK/index.android.bundle" "$WORK/unsigned.apk"

echo "[4/5] Aligning"
"$ZIPALIGN" -p -f 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"

echo "[5/5] Signing"
if [ ! -f "$KEYSTORE" ]; then
  echo "Creating keystore $KEYSTORE"
  "$KEYTOOL" -genkeypair -keystore "$KEYSTORE" -storepass:env PIX_KS_PASS -keypass:env PIX_KS_PASS \
    -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 20000 -dname "CN=Pix Local"
fi
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-pass env:PIX_KS_PASS --key-pass env:PIX_KS_PASS \
  --ks-key-alias "$KEY_ALIAS" --out "$OUT" "$WORK/aligned.apk"
"$APKSIGNER" verify "$OUT"

echo "Built $OUT"
