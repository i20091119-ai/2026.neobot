# 네오봇 수학SW체험 — 안드로이드 태블릿판

웹앱(저장소 루트의 html·js·assets·assembly …)을 앱 안에 그대로 넣고, USB 동글(CP210x) 통신만 앱이 맡음.

- `MainActivity.java`: WebView로 `https://appassets.androidplatform.net/index.html`(앱 내부 파일) 표시, `NBAndroid` 브리지 제공
- `Cp210x.java`: 동글 드라이버(라이브러리 없음, USB 제어·벌크 전송)
- `src/main/web/android-serial.js`: 브리지를 `navigator.serial` 모양으로 감쌈 → `js/neobot.js` 수정 없이 동작. 모든 HTML `<head>` 맨 앞에 자동 삽입
- 빌드할 때 `copyWeb` 작업이 저장소의 웹 파일을 `assets/www`로 복사 → 웹앱을 고치면 다시 빌드만

## 빌드
```
cd android
gradle assembleRelease      # → app/build/outputs/apk/release/app-release.apk (디버그 키 서명)
```
필요: JDK 17+, Android SDK(platform 34, build-tools), `local.properties`에 `sdk.dir=...`

## 태블릿에서
- 안드로이드 7.0 이상, USB OTG 지원 태블릿 + USB-C(또는 마이크로USB) OTG 젠더
- APK 설치: '출처를 알 수 없는 앱' 허용 필요
- 동글을 꽂으면 '네오봇 SW체험 열기' 질문 → **항상** 선택하면 다음부터 권한 질문 없음
