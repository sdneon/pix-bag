# Reviving the original Pix Backpack app (v1.40)

This folder patches **your own copy** of the original vendor app ("Pix Backpack" v1.40 for Android) so it works again without the vendor's servers. You don't need it to use Pix Bag. It's for people who prefer the original app's editor and built-in widgets.

**The original APK is not included and is not distributed here.** You need to supply your own copy.

## What the patch does

The original app's JavaScript bundle is plain text inside the APK. `patch-bundle.js` makes a few small, anchored text replacements (each must match exactly once, otherwise it stops without writing anything) and puts `local-server.js` in front of the bundle:

- Ignores the vendor's remote "sunset" shutdown switch, both the stored flag and the server reply.
- Sends the app's API calls to a small offline stand-in (`local-server.js`) that keeps your projects on the phone (in the app's own storage).
- Generates project previews on the phone.
- Shows the market screen (built-in widgets and games) instead of staying on "Loading store...".
- Sizes the project preview so it fits tall and near-square screens.

`repack.py` puts the patched bundle back into the APK and removes the old signature. The build script then runs `zipalign` and signs the APK with your own key.

## What still doesn't work

Anything that needed the vendor's cloud is gone for good: sharing, login/accounts, firmware updates and store content.

## Requirements

- Your own copy of the original **Pix Backpack v1.40** APK (other versions will fail the anchor check).
  If you got it from anywhere other than your own phone, check it first - the known-good file is
  29,270,966 bytes with SHA-256 `4a35fb4bb18690048aa9ea3ac42adccd872608b819b5c0ecc3c3b6599ff5de51`
  (PowerShell: `Get-FileHash <file>`; Linux/macOS: `sha256sum <file>`).
- Node.js 18+
- Python 3
- Android SDK build-tools (`zipalign`, `apksigner`), on PATH or via `ANDROID_HOME`
- A JDK (17+) for `keytool`, on PATH or via `JAVA_HOME`

## Build

Windows (PowerShell):

```powershell
.\build-a.ps1 -Apk path\to\PixBackpack-1.40.apk
# optional: -Out my.apk -Keystore my.jks -KeyAlias pix -KeystorePassword ******
```

Linux / macOS:

```bash
./build-a.sh path/to/PixBackpack-1.40.apk [out.apk]
# optional env: KEYSTORE, KEY_ALIAS, PIX_KS_PASS
```

If the keystore doesn't exist yet, it is created (default `keys/pix-local.jks` in this folder). The password comes from `-KeystorePassword` / `PIX_KS_PASS`, or you are prompted. **Keep the keystore and password**: a later rebuild must be signed with the same key to install as an update.

The result is `out/PixBackpack-1.40-revived.apk` unless you choose another path.

To check the offline server on its own: `node test-local-server.js`.

## Install

> **Uninstall the store-installed original app first.** The patched APK has a different signature, so Android won't install it over the original. Uninstalling deletes the original app's local data (projects saved on the phone).

Then install the patched APK (for example `adb install out/PixBackpack-1.40-revived.apk`, or copy it to the phone and open it).

## Files

| File | Purpose |
| ---- | ------- |
| `patch-bundle.js` | Applies the bundle patches and prepends `local-server.js` |
| `local-server.js` | Offline stand-in for the vendor API, stores projects on the phone |
| `repack.py` | Swaps the bundle into the APK and strips the old signature |
| `build-a.ps1` / `build-a.sh` | Full build: extract, patch, repack, align, sign |
| `test-local-server.js` | Smoke test for `local-server.js` |
