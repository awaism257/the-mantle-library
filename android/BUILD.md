# Mantle Library — Android (WebView shell)

A thin native **Java `Activity` + `WebView`** shell that loads the live PWA at `https://mantlelibrary.app/`. All UI, content, audio and offline logic ship from the web app (Netlify); this project contributes the icons, splash/system-bar styling, package identity, signing, Play Store presence — and the **native-only features** the web cannot do.

```
Android shell (this project)
  └── MainActivity (Activity + WebView)
        ├── loads https://mantlelibrary.app/
        └── AndroidBridge (JavaScript interface)
              ├── onThemeChanged(boolean isDark)        → system-bar icon colours
              ├── onReaderState(boolean open)           → a paged (Book Mode) reader is open
              ├── onAudioState(boolean playing)         → narration is playing
              └── onVolumePagingSetting(boolean on)     → user setting (default ON)
```

> This replaced the earlier Trusted Web Activity. There is no `assetlinks.json` requirement any more.

## Volume-key page turning (v1.0.3+)

Handled in `MainActivity.onKeyDown / onKeyUp`:

| Condition | Volume Down | Volume Up |
|-----------|-------------|-----------|
| Book Mode reader open **and** audio **not** playing **and** setting on | next page | previous page |
| Anything else (home, settings, audio playing, setting off) | normal media volume | normal media volume |

The shell calls `window.mantleTurnPage(+1 / -1)` in the web app (see `js/app.js`, Book Mode). Auto-repeat is ignored. `setVolumeControlStream(STREAM_MUSIC)` makes the keys drive the media stream. The web/PWA cannot intercept hardware volume keys — it uses PageDown / PageUp / arrow keys, swipe and on-screen buttons instead. The in-app toggle ("Turn pages with the volume keys") appears only inside this native app.

**Order of release:** deploy the web app first (git push → Netlify), then publish the AAB. Every bridge call is guarded in the web app, so older shells simply ignore the new calls.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| JDK | 17 | `/home/awais/jdk-17` |
| Android SDK | API 36 | `/home/awais/android-sdk` |
| Gradle | via wrapper | `./gradlew` |

```bash
export JAVA_HOME=/home/awais/jdk-17
export ANDROID_HOME=/home/awais/android-sdk
```

## Build

Release signing uses `keystore/mantle-release.jks` with credentials taken from **environment variables — never commit them**:

```bash
export KEYSTORE_PASSWORD="…"      # keep in your password manager
export KEY_ALIAS="munajaat"
export KEY_PASSWORD="…"
```

### Debug APK (sideload to test)
```bash
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

### Release AAB (Play Store upload)
```bash
./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

### Signed release APK (direct install)
```bash
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

## Versioning

Bump `versionCode` (integer, must increase every upload) and `versionName` in `app/build.gradle.kts` for each Play release.

| versionName | versionCode | Notes |
|-------------|-------------|-------|
| 1.0.2 | 3 | WebView shell |
| 1.0.3 | 4 | Volume-key page turning, Sīrah Book Mode |
| 1.0.4 | 5 | Continuous flowing prose, sentence highlight, 12 chapters |
