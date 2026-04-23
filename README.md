# Dezleks

Dezleks — застосунок для зчитування тексту з фото (OCR) та зручного читання. Проєкт орієнтований на людей з дислексією, яким читання звичайним шрифтом може бути ускладнене: застосунок використовує спеціальні шрифти (зокрема OpenDyslexic), що допомагають полегшити читання.

## Можливості

- OCR з фото:
  - Tesseract (локально на пристрої)
  - Gemma (OCR / очищення тексту нейромережею)
- Виділення області (ROI) для розпізнавання
- Корекція перспективи (4 точки) перед OCR
- Поворот зображення на 90° (вліво/вправо)
- Очищення та виправлення OCR-тексту нейромережею
  - можна задати власний промпт для очищення
- Завантаження моделі Gemma з посилання (за потреби — з токеном доступу)
- Налаштування вигляду тексту для читання
  - шрифти (в т.ч. OpenDyslexic), розмір, міжряддя, кольори фону/тексту

## Платформи

- Android: основна цільова платформа

## Збірка та запуск (коротко)

### Встановлення залежностей

```bash
npm install
```

### Dev-режим (Tauri)

```bash
npm run dev
```

### Android APK (debug)

```bash
PATH="$HOME/.cargo/bin:$PATH" \
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools \
NDK_HOME=/opt/homebrew/share/android-commandlinetools/ndk/26.1.10909125 \
CI=true \
./node_modules/.bin/tauri android build --debug --apk --target aarch64 -v
```

Готовий APK з’явиться у:

- `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

## Ліцензія

Цей проєкт доступний безкоштовно для некомерційного використання. Деталі — у файлі [LICENSE](./LICENSE).

---

# Dezleks (English)

Dezleks is an app for extracting text from photos (OCR) and reading it comfortably. It is designed with dyslexic readers in mind: reading with a regular font can be difficult, so the app supports specialized fonts (including OpenDyslexic) to make reading easier.

## Features

- OCR from photos:
  - Tesseract (on-device)
  - Gemma (OCR / AI-powered text cleanup)
- Region of interest (ROI) selection for OCR
- Perspective correction (4-point) before OCR
- Rotate image by 90° (left/right)
- AI cleanup and correction of OCR text
  - custom cleanup prompt is supported
- Download Gemma model from a URL (optional access token)
- Reading view customization
  - fonts (including OpenDyslexic), font size, line height, background/text colors

## Platforms

- Android: primary target platform

## Build & Run (short)

### Install dependencies

```bash
npm install
```

### Dev (Tauri)

```bash
npm run dev
```

### Android APK (debug)

```bash
PATH="$HOME/.cargo/bin:$PATH" \
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools \
NDK_HOME=/opt/homebrew/share/android-commandlinetools/ndk/26.1.10909125 \
CI=true \
./node_modules/.bin/tauri android build --debug --apk --target aarch64 -v
```

The resulting APK will be located at:

- `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

## License

This project is free for non-commercial use. See [LICENSE](./LICENSE) for details.
