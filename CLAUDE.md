# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A [Bob](https://bobtranslate.com/) TTS plugin that uses an OpenAI-compatible Qwen TTS service (`POST /v1/audio/speech`, non-streaming). Bob is a macOS translation/TTS app; plugins run in a custom JavaScript runtime (not Node.js, not browser).

## Build & Package

```bash
# Package the plugin (run from project root)
cd src && zip -r ../qwen-tts.bobplugin . -x ".*"

# Get SHA256 for appcast.json
shasum -a 256 qwen-tts.bobplugin
```

There is no build system, linter, or test framework. The plugin is a zip of the `src/` directory renamed to `.bobplugin`.

## Architecture

- **`src/info.json`** — Plugin metadata, version, and user-configurable options (Base URL, optional API Key, model, voice, lang_code override, instruct, temperature/top_p/top_k/repetition_penalty/max_tokens, audio format, timeout). This is the Bob plugin manifest. Identifier is `com.qwen.tts.bob.plugin` (rebranded in 2.0; existing installs must reinstall manually); version is 2.0.0.
- **`src/main.js`** — Core TTS logic. Exports `supportLanguages()`, `tts()`, `pluginTimeoutInterval()`, and `pluginValidate()` as the Bob plugin interface. Sends a single non-streaming POST via `$http.request` to `{baseUrl}/v1/audio/speech` and returns the raw audio bytes as base64.
- **`src/lang.js`** — Supported language list, lookup, and Bob-code → Qwen `lang_code` mapping (`toQwenLangCode()`).
- **`appcast.json`** — Version manifest for Bob's auto-update system. Versions array is reverse-chronological (newest first).

## Bob Plugin Runtime Constraints

- **No ES6 modules** — use `require()` / `exports` (CommonJS-style)
- **No Node.js or browser APIs** — only JS built-ins and Bob globals: `$http`, `$data`, `$option`, `$log`
- Non-streaming: uses `$http.request()` (no `streamHandler`, no Bob 1.8.0 requirement)
- Success responses are raw audio bytes at `resp.rawData` (binary `$data`, convert with `.toBase64()`); `resp.data` is Bob's JSON-parse attempt (garbled/head-truncated for binary — Bob logs a harmless JSON-parse warning). Error bodies read from `resp.data` (parsed JSON)
- `$option.<identifier>` reads values from user plugin settings defined in `info.json`

## Release Process

1. Edit source in `src/`, bump version in `src/info.json`
2. Re-package: `cd src && zip -r ../qwen-tts.bobplugin . -x ".*"`
3. Get SHA256: `shasum -a 256 qwen-tts.bobplugin`
4. Prepend new version entry to `appcast.json` (with sha256, timestamp via `date +%s000`)
5. Commit, push, then create GitHub Release: `gh release create vX.Y.Z qwen-tts.bobplugin --title "..." --notes "..."`

## API Details

- `POST {baseUrl}/v1/audio/speech` with `Content-Type: application/json`, plus `Authorization: Bearer <key>` only when API Key is set
- Body: `{model, input, voice, lang_code, [instruct], temperature, top_p, top_k, repetition_penalty, max_tokens, response_format, stream: false}` — `instruct` is omitted when empty
- Reference: model `mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit`, voice `Serena`, `lang_code` e.g. `Chinese`, `response_format` `wav`/`mp3`
- `lang_code` auto-mapping: zh-Hans/zh-Hant→Chinese, en→English, ja→Japanese, ko→Korean, fr→French, de→German, es→Spanish, pt→Portuguese, id→Indonesian; explicit `langCode` option overrides verbatim
