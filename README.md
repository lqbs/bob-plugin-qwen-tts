# Bob Plugin - Qwen TTS

使用 OpenAI 兼容的 Qwen TTS 语音服务（`POST /v1/audio/speech`）为 [Bob](https://bobtranslate.com/) 提供语音合成服务。默认连接本地服务 `http://127.0.0.1:8000`，也可指向任意远程兼容服务。

非流式：一次请求返回完整音频，对 Bob 版本无额外要求（`minBobVersion: 1.0.0`，不用 `streamHandler`）。

## 功能特性

- OpenAI 兼容的 `/v1/audio/speech` 接口（`stream: false`，单次返回完整音频）
- 服务地址、模型、音色均可配置（默认模型 `mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit`，默认音色 `Serena`）
- `lang_code` 留空时按 Bob 当前语言自动映射，可手动强制覆盖（原样透传）
- 可调 `instruct` 说话风格指示，以及 `temperature` / `top_p` / `top_k` / `repetition_penalty` / `max_tokens`，非法值自动钳制回默认值区间
- 支持 WAV（推荐） / MP3；WAV 自带 RIFF 头完整性校验，下载不完整自动重试一次
- API Key 可选（本地服务留空即可，需要鉴权的服务端才填写）
- 自带 `pluginValidate`：Bob 点“验证”时用 `你好` 做一次小 token 合成测试

## 支持语言

插件声明的支持语言（`supportLanguages()`）共 10 种，`lang_code` 留空时按下表自动映射：

| Bob 语言 | `lang_code` |
|----------|-------------|
| zh-Hans（简体中文） | Chinese |
| zh-Hant（繁体中文） | Chinese（服务端中文只有一个取值，刻意回退） |
| en（英语） | English |
| ja（日语） | Japanese |
| ko（韩语） | Korean |
| fr（法语） | French |
| de（德语） | German |
| es（西班牙语） | Spanish |
| pt（葡萄牙语） | Portuguese |
| id（印尼语） | Indonesian |

不在上表中的语言会直接报 `unsupportLanguage`；`lang_code` 配置项一旦填写则原样透传，不再走映射。

## 安装

### 前置要求

- Bob（仅用 `$http.request`，无流式接口依赖）
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

### 本地服务部署（mlx-audio，Serena 中文）

以 `mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit` + 音色 `Serena` 为例：

```bash
# 启动服务（保持常驻，避免每次重新加载模型）
mlx_audio.server \
  --host 0.0.0.0 \
  --port 8000
```

```bash
# 命令行先验证一次（只确认模型/音色可用，与插件无关）
mlx_audio.tts.generate \
  --model mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit \
  --text "你好，很高兴见到你。这里是 Serena 中文语音测试。" \
  --voice Serena \
  --lang_code Chinese \
  --instruct "温柔、自然、清晰地说，语速适中" \
  --output_path ./output
```

注意：该部署文档推荐 `stream: true` + `streaming_interval: 0.32` 以降低首字延迟，但本插件是非流式的（固定 `stream: false`，一次取回完整音频），这两个参数不适用。降低延迟靠：服务常驻、启动后先发一次短请求 warm-up、文本按句切分（每段约 10～40 个汉字）。

局域网其他设备调用时，把插件的服务地址（Base URL）改成 Mac 的局域网 IP 即可，如 `http://192.168.1.100:8000`（插件自动拼接 `/v1/audio/speech`）。

### 安装步骤

1. 下载最新的 `qwen-tts.bobplugin` 文件（2.0 起使用全新标识符 `com.qwen.tts.bob.plugin`，老版本需手动安装一次，不能直接覆盖升级）
2. 双击文件，Bob 会自动弹出安装确认
3. 在 Bob 插件设置中确认服务地址（本地服务保持默认即可）
4. 可选：点插件设置里的“验证”，插件会用“你好”合成一次确认服务可用（`max_tokens: 200`，超时 30 秒）

## 配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 服务地址 (Base URL) | 兼容服务的根地址，插件自动拼接 `/v1/audio/speech`，末尾斜杠可加可不加 | `http://127.0.0.1:8000` |
| API Key（可选） | 填写后以 `Authorization: Bearer` 发送，留空则不发送该头 | 留空 |
| 模型 | 透传 `model`，清空会报错提示填写 | `mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit` |
| 音色 (voice) | 透传 `voice`（如 `Serena`），清空会报错提示填写 | `Serena` |
| 语言 (lang_code，留空自动) | 留空按 Bob 语言自动映射，填写则强制使用（原样透传） | 留空 |
| 指令 (instruct) | 从未设置时用默认风格；手动清空后则不发送该字段（兼容严格校验的服务端） | `自然、清晰、温和地说` |
| temperature | 范围 0-2，非法值回退/钳制 | `0.8` |
| top_p | 范围 0-1，非法值回退/钳制 | `0.95` |
| top_k | 范围 0-100（整数），非法值回退/钳制 | `50` |
| repetition_penalty | 范围 1.0-2.0，非法值回退/钳制 | `1.05` |
| max_tokens | 范围 1-8192（整数），非法值回退/钳制 | `2400` |
| 音频格式 (response_format) | WAV（推荐，带完整性校验）/ MP3 | `wav` |
| 超时时间（秒） | 范围 30-300，非法值回退/钳制 | `60` |

### Serena 中文推荐参数

部署文档给出的 Serena 中文推荐值，对应到插件配置项：

| 插件配置项 | 推荐值 |
|-----------|--------|
| 音色 (voice) | `Serena` |
| 语言 (lang_code) | 留空（zh-Hans 自动映射 Chinese）或填 `Chinese` |
| 指令 (instruct) | `温柔、自然、清晰地说，语速适中` |
| temperature | `0.7`（插件默认 `0.8`，按需改） |
| top_p | `0.9`（插件默认 `0.95`，按需改） |
| top_k | `40`（插件默认 `50`，按需改） |
| repetition_penalty | `1.05`（与默认一致） |
| 音频格式 | `wav` |

长文本建议按句切分后分别合成（每段约 10～40 个汉字）；`max_tokens` 默认 `2400` 一般够用，超长文本可适当调大。

## 工作原理

1. 取 Bob 当前语言（`query.lang`），`langCode` 为空则查映射表得到 `lang_code`，否则用填写值。
2. 发 `POST {baseUrl}/v1/audio/speech`，请求体：
   ```json
   {
     "model": "<model>",
     "input": "<Bob 传入文本>",
     "voice": "<voice>",
     "lang_code": "<映射或覆盖值>",
     "temperature": 0.8, "top_p": 0.95, "top_k": 50,
     "repetition_penalty": 1.05, "max_tokens": 2400,
     "response_format": "wav",
     "stream": false
   }
   ```
   `instruct` 非空时才带上该字段；`Authorization` 仅在 API Key 非空时发送。
3. 成功时取 `resp.rawData`（二进制原字节）转 base64 返回。注意：`resp.data` 是 Bob 的 JSON 解析尝试，二进制音频经它解析后头部已损坏，必须用 `rawData`（否则播放开头被截断）。Bob 日志里那条 JSON 解析警告可忽略。
4. WAV 完整性：服务端用 chunked 传输、无 `Content-Length`，插件按 RIFF 头 bytes 4–7（小端 uint32）`= 文件总长 - 8` 校验。已接收字节不足时自动重试一次（仅一次），仍不完整则报“音频下载不完整，请重试”；头非法则报“非法的 WAV 文件头”。MP3 跳过此校验。

## 调试与排错

在 Bob「偏好设置 → 高级 → 日志」中查看插件日志，插件会记录请求 URL / 模型 / 音色 / `lang_code`、响应 keys、音频长度（`rawData` / `data`）以及重试和失败原因。

| 现象 | 说明 |
|------|------|
| 日志有 JSON 解析警告但能正常播放 | 正常。Bob 尝试把 WAV 按 JSON 解析必然失败，插件用的是 `rawData` |
| `音频下载不完整（已接收 x / 应为 y 字节），自动重试` | chunked 传输被截断，插件已自动再试一次；重试后仍失败请重试或检查服务端 |
| `请求失败（HTTP xxx）` + 错误体片段 | 服务端返回的非 2xx，addition 里是响应体前 200 字符，检查模型/音色/`lang_code` 参数 |
| `请求服务器失败` | 网络层错误（连不上、超时），检查 Base URL 与超时设置 |
| `服务器未返回音频数据` | 2xx 但无音频字节，检查服务端日志 |
| `合成文本不能为空` / `不支持的语言` / `请填写服务地址/模型/音色` | 参数校验，照提示补即可 |

## 开发

### 项目结构

```
src/
├── info.json    # 插件元信息和配置项（标识符 com.qwen.tts.bob.plugin，当前 2.0.0）
├── main.js      # 核心 TTS 逻辑（tts / pluginValidate / pluginTimeoutInterval / supportLanguages）
└── lang.js      # 语言列表与 Bob 代码 → lang_code 映射（toQwenLangCode）
```

### 打包

```bash
cd src && zip -r ../qwen-tts.bobplugin . -x ".*"
```

发布另需更新 `appcast.json`（新版本置顶，附 sha256 与时间戳），详见 `CLAUDE.md` 的 Release Process。

## 相关文档

- [Bob 插件开发文档](https://bobtranslate.com/plugin/)

## 许可证

MIT
