# Pix Bag - Pix's Back! 😁

An open-source Android app for the [**PIX: The Backpack**](https://www.kickstarter.com/projects/pixbackpack/pix-the-first-smart-animative-backpack) - the legacy Kickstarter backpack with a 16×20px colour LED display.
Modded from [Raimond Brookman's PixelPackerOSS](https://github.com/RaimondB/PixelPackerOSS).

Draw pixel animations, upload them to the backpack, and use the clock, scrolling text, bike signals and games, with no account or server needed.

> **Disclaimer:** Pix Bag is an independent community project. It is not affiliated with, endorsed by, or supported by the original makers of the PIX backpack or their app.

## Why

The company behind the PIX backpack is gone, and so are its servers. The original app depends on them and no longer works properly. Pix Bag talks to the backpack directly over BLE and keeps everything on your phone.

## Features

- **Gallery home screen**: your saved animations plus the built-in ones, with thumbnails. Tap to edit (built-ins open as an editable copy). The `⋯` menu on each item offers edit / preview / upload / duplicate / delete.
- **Animation editor**
  - Tools: pen, erase, line, rectangle, flood fill, colour picker
  - Undo / redo (100 steps)
  - 16-slot palette. Long-press a swatch to edit it (HSV sliders, hex, quick swatches), `+` adds a slot
  - Frame strip with live thumbnails: new, duplicate, move left/right, delete
  - Frame duration per frame or for all frames (slider + presets)
  - "More…" menu: flip horizontal/vertical, shift with wrap-around, clear, copy/paste frame (also between animations, colours are mapped), playback direction (Loop, Ping-pong, Play once, Ping-pong once), onion skin
  - Preview player, save, upload to the backpack (checks frame count and size)
  - Asks before leaving with unsaved changes
  - Layouts for phones, unfolded foldables (side panel) and narrow cover screens
- **Device page** (tap the chip at the top right)
  - Scan for backpacks, or one tap to reconnect to the last one
  - Brightness slider and presets
  - Display modes: Animation, Clock, Scrolling, Stopwatch, Countdown, Bike, Pix Blocks, Pixel Breaker, Crawler, Off
  - Clock (sets the backpack's time), Countdown timer, Bike turn/brake signals, Pixel Breaker game pad
  - Widgets: Scrolling Text (colour + speed), Roll the Dice
  - Restart, demo mode toggle, diagnostics test upload
  - Auto-reconnect when the link drops. The chip turns red if the link is lost
- **Backup / Restore** of all your animations as a JSON file (merge or replace)

See the **[User guide](docs/user-guide.md)** for a walkthrough.

## Install

1. Download the latest Pix Bag APK from the [Releases](../../releases) page.
2. Open it on your phone and allow installing from that source if Android asks.
3. Turn on Bluetooth, open Pix Bag, tap **Connect backpack** and scan.

Requirements: Android 6.0+ (API 23), Bluetooth LE, a PIX backpack.

Notes:
- Pix Bag does not need the original app and can be installed next to it.
- The package id is `com.pixconnector`. Earlier builds of this app with the same id and signing key are upgraded in place. If Android refuses the update ("package conflicts"), the old build was signed with a different key: make a **Backup** first, uninstall, install Pix Bag, then **Restore**.

## Build from source

Prerequisites: Node.js 18+, JDK 17, Android SDK (platform 34, build-tools 34.0.0, NDK 26.1.10909125). On Ubuntu / WSL2, `bash setup.sh` installs these and creates the debug keystore.

```bash
cd pix-connector
npm install
```

The build signs with `pix-connector/android/app/debug.keystore`, which is not in the repository. `setup.sh` creates it, or:

```bash
keytool -genkey -v -keystore pix-connector/android/app/debug.keystore \
  -storepass android -alias androiddebugkey -keypass android \
  -dname "CN=Android Debug,O=Android,C=US" -keyalg RSA -keysize 2048 -validity 10000
```

**Release APK** (Gradle bundles the JS itself):

```bash
cd pix-connector/android
./gradlew assembleRelease        # Windows: gradlew.bat assembleRelease
# -> app/build/outputs/apk/release/app-release.apk
```

**Debug APK without a dev server** (bundle the JS first):

```bash
cd pix-connector
npx react-native bundle --entry-file index.js --platform android --dev false \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Or run against the Metro dev server with `npx react-native run-android`.

An APK signed with your own key cannot update one signed with a different key (see the Install notes).

## BLE protocol

The backpack uses a proprietary BLE service. Key opcodes:

| Opcode | Name | Description |
| ------ | ---- | ----------- |
| 0 | SET_FRAME | Upload a frame (8bpp palette-indexed, 16×20 = 320 bytes) |
| 1 | SET_PALETTE | Set palette (RGB triplets, up to 16 colors) |
| 2 | SET_FRAME_COUNT | Set number of active frames |
| 3 | SET_FRAMES_DURATIONS | Set per-frame durations (uint16 LE, ms) |
| 4 | SET_ANIMATION_DIRECTION | 0 = loop, 1 = ping-pong, 2 = play once, 3 = ping-pong once |
| 5 | SAVE_TO_PERSISTENT_MEMORY | Persist current animation to flash |
| 7 | SET_CONFIG | Set render mode and parameters |
| 8 | SET_INPUT | Send game/widget input |
| 9 | RESTART | Reboot device |

Three hardware revisions exist with different BLE service UUID bases; the app detects which one it is talking to. See `pix-connector/src/ble/` for details.

## Project structure

```text
pix-connector/            Pix Bag app (React Native 0.74, Android)
  src/
    ble/                  BLE service, device protocol, upload, font bitmaps
    screens/              Gallery, editor, device page, clock, bike, games, ...
    editor/               Pixel operations (fill, lines, flips, shifts)
    storage/              Saved animations (AsyncStorage) and backup/restore
    ui/                   Shared widgets (colour editor, slider, pixel images)
    data/                 Built-in animations
  android/                Android project
docs/                     User guide and screenshots
original-app-revive/      Optional patch kit for the original vendor app
setup.sh                  Dev environment bootstrap (Ubuntu / WSL2)
```

## Reviving the original app (optional)

[`original-app-revive/`](original-app-revive/README.md) has scripts that patch **your own copy** of the original vendor app (v1.40) so it starts and keeps your projects offline instead of waiting for its dead servers. The original APK is not included, and cloud features stay dead. See its [README](original-app-revive/README.md).

## Credits

Pix Bag is a fork of [**PixelPackerOSS**](https://github.com/RaimondB/PixelPackerOSS), the open-source re-implementation of the PIX backpack BLE protocol, and is released under the same license.

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).
