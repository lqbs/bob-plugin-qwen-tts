# Bob Plugin - Qwen TTS

使用 OpenAI 兼容的 Qwen TTS 语音服务（`POST /v1/audio/speech`）为 [Bob](https://bobtranslate.com/) 提供语音合成服务。默认连接本地服务 `http://127.0.0.1:8000`，也可指向任意远程兼容服务。

## 功能特性

- 基于 OpenAI 兼容的 `/v1/audio/speech` 接口（非流式，一次返回完整音频）
- 服务地址、模型、音色均可配置（默认模型 `mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit`，默认音色 `Serena`）
- `lang_code` 留空时按 Bob 当前语言自动映射，可手动强制覆盖
- 可调 `instruct` 说话风格指示，以及 `temperature` / `top_p` / `top_k` / `repetition_penalty` / `max_tokens`
- 支持 WAV / MP3 音频格式
- API Key 可选（本地服务留空即可，需要鉴权的服务端才填写）

## 安装

### 前置要求

- Bob（`$http.request` 为早期即有 API，无流式接口依赖）
- 本地或远程 Qwen TTS 服务，例如：

```bash
curl http://127.0.0.1:8000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit",
    "input": "你好，欢迎使用我们的语音服务。",
    "voice": "Serena",
    "lang_code": "Chinese",
    "instruct": "自然、清晰、温和地说",
    "temperature": 0.8,
    "top_p": 0.95,
    "top_k": 50,
    "repetition_penalty": 1.05,
    "max_tokens": 2400,
    "response_format": "wav",
    "stream": false
  }' \
  --output speech.wav
```

### 安装步骤

1. 下载最新的 `qwen-tts.bobplugin` 文件（2.0 起使用全新标识符，需手动安装一次）
2. 双击文件，Bob 会自动弹出安装确认
3. 在 Bob 插件设置中确认服务地址（本地服务保持默认即可）

## 配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 服务地址 (Base URL) | 兼容服务的根地址，插件自动拼接 `/v1/audio/speech` | `http://127.0.0.1:8000` |
| API Key（可选） | 填写后以 `Authorization: Bearer` 发送，留空则不发送 | 留空 |
| 模型 | 透传 `model` | `mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit` |
| 音色 (voice) | 透传 `voice` | `Serena` |
| 语言 (lang_code，留空自动) | 留空按 Bob 语言自动映射，填写则强制使用 | 留空 |
| 指令 (instruct) | 说话风格指示；清空则不发送该字段 | `自然、清晰、温和地说` |
| temperature | 范围 0-2 | `0.8` |
| top_p | 范围 0-1 | `0.95` |
| top_k | 范围 0-100（整数） | `50` |
| repetition_penalty | 范围 1.0-2.0 | `1.05` |
| max_tokens | 范围 1-8192（整数） | `2400` |
| 音频格式 (response_format) | WAV（推荐）/ MP3 | `wav` |
| 超时时间（秒） | 范围 30-300 | `60` |

## 开发

### 项目结构

```
src/
├── info.json    # 插件元信息和配置项
├── main.js      # 核心 TTS 逻辑
└── lang.js      # 语言映射（Bob 代码 → lang_code）
```

### 打包

```bash
cd src && zip -r ../qwen-tts.bobplugin . -x ".*"
```

### 调试

在 Bob 的「偏好设置 → 高级 → 日志」中查看插件日志。

## 相关文档

- [Bob 插件开发文档](https://bobtranslate.com/plugin/)

## 许可证

MIT
