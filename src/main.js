/**
 * Bob Qwen TTS 插件
 * OpenAI 兼容接口：POST {baseUrl}/v1/audio/speech（非流式，stream: false）
 * 成功时服务端直接返回原始音频字节，失败时返回非 2xx 状态码及错误信息。
 */

var lang = require('./lang.js');

function supportLanguages() {
    return lang.supportLanguages.map(function (item) {
        return item[0];
    });
}

function optionText(identifier, defaultValue) {
    var value = $option[identifier];
    if (value === undefined || value === null || String(value).trim() === '') {
        return defaultValue;
    }
    return String(value).trim();
}

function clampInteger(value, defaultValue, minimum, maximum) {
    var number = parseInt(value, 10);
    if (isNaN(number)) number = defaultValue;
    if (number < minimum) number = minimum;
    if (number > maximum) number = maximum;
    return number;
}

function clampFloat(value, defaultValue, minimum, maximum) {
    var number = parseFloat(value);
    if (isNaN(number)) number = defaultValue;
    if (number < minimum) number = minimum;
    if (number > maximum) number = maximum;
    return number;
}

var B64CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64DecodePrefix(b64, count) {
    var out = [];
    var val = 0, bits = 0;
    for (var i = 0; i < b64.length && out.length < count; i++) {
        var v = B64CHARS.indexOf(b64.charAt(i));
        if (v < 0) continue;
        val = (val << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((val >> bits) & 0xFF);
        }
    }
    return out;
}

function b64ByteLength(b64) {
    var padding = 0;
    if (b64.charAt(b64.length - 1) === '=') padding++;
    if (b64.length > 1 && b64.charAt(b64.length - 2) === '=') padding++;
    return Math.floor(b64.length * 3 / 4) - padding;
}

/**
 * 校验 WAV 完整性：RIFF 头 bytes 4-7（小端 uint32）= 文件总长度 - 8。
 * 服务端使用 chunked 传输且无 Content-Length，这是唯一可靠的完整性依据。
 * 返回 null 表示跳过校验（非 WAV）；否则返回 {headerOk, expected, actual}。
 */
function wavLengthInfo(b64) {
    var head = b64DecodePrefix(b64, 12);
    if (head.length < 12) return { headerOk: false, expected: -1, actual: b64ByteLength(b64) };
    var isRiff = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;
    var isWave = head[8] === 0x57 && head[9] === 0x41 && head[10] === 0x56 && head[11] === 0x45;
    if (!isRiff || !isWave) return null;
    var riffSize = head[4] + head[5] * 256 + head[6] * 65536 + head[7] * 16777216;
    return { headerOk: true, expected: riffSize + 8, actual: b64ByteLength(b64) };
}

function audioStatus(audioData, responseFormat) {
    if (!audioData || (audioData.length !== undefined && audioData.length === 0)) {
        return { state: 'empty' };
    }
    var b64;
    try {
        b64 = audioData.toBase64();
    } catch (error) {
        return { state: 'broken', message: error && error.message ? error.message : String(error) };
    }
    if (!b64) return { state: 'empty' };
    if (responseFormat === 'wav') {
        var info = wavLengthInfo(b64);
        if (info && !info.headerOk) {
            return { state: 'broken', message: '非法的 WAV 文件头' };
        }
        if (info && info.expected > 44 && info.actual < info.expected) {
            return { state: 'incomplete', b64: b64, expected: info.expected, actual: info.actual };
        }
    }
    return { state: 'ok', b64: b64 };
}

function buildSpeechUrl(baseUrl) {
    var base = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return '';
    return base + '/v1/audio/speech';
}

function resolveLangCode(bobLang) {
    var explicit = optionText('langCode', '');
    if (explicit) return explicit;
    return lang.toQwenLangCode(bobLang);
}

function readInstruct() {
    // 未设置时使用默认风格；用户手动清空后则省略该字段（兼容严格校验的服务端）。
    if ($option.instruct === undefined || $option.instruct === null) {
        return '自然、清晰、温和地说';
    }
    return String($option.instruct).trim();
}

function createApiError(message, addition) {
    return {
        type: 'api',
        message: message,
        addition: addition || ''
    };
}

function responseBodySnippet(resp) {
    try {
        var data = resp.data;
        if (data === undefined || data === null) return '';
        if (typeof data === 'string') return data.substring(0, 200);
        return JSON.stringify(data).substring(0, 200);
    } catch (error) {
        return '';
    }
}

/**
 * 调用 OpenAI 兼容的 /v1/audio/speech 接口（非流式，单次返回完整音频）。
 */
function synthesize(text, options, completion) {
    var completed = false;

    function complete(result) {
        if (completed) return;
        completed = true;
        completion(result);
    }

    var url = buildSpeechUrl(options.baseUrl);
    if (!url) {
        complete({
            error: { type: 'param', message: '请在插件配置中填写服务地址 (Base URL)' }
        });
        return;
    }

    var headers = {
        'Content-Type': 'application/json'
    };
    if (options.apiKey) {
        headers['Authorization'] = 'Bearer ' + options.apiKey;
    }

    var body = {
        model: options.model,
        input: text,
        voice: options.voice,
        lang_code: options.langCode,
        temperature: options.temperature,
        top_p: options.topP,
        top_k: options.topK,
        repetition_penalty: options.repetitionPenalty,
        max_tokens: options.maxTokens,
        response_format: options.responseFormat,
        stream: false
    };
    if (options.instruct) {
        body['instruct'] = options.instruct;
    }

    $log.info('Qwen TTS 请求: url=' + url + ', model=' + options.model + ', voice=' + options.voice + ', lang_code=' + options.langCode);

    var attemptCount = 0;
    function attempt() {
        attemptCount++;
        $http.request({
            method: 'POST',
            url: url,
            header: headers,
            body: body,
            timeout: options.timeout,
            handler: function (resp) {
                var status = audioStatus(resp && (resp.rawData || resp.data), options.responseFormat);
                if (status.state === 'incomplete' && attemptCount < 2) {
                    $log.error('Qwen TTS 音频下载不完整（已接收 ' + status.actual + ' / 应为 ' + status.expected + ' 字节），自动重试');
                    attempt();
                    return;
                }
                onResult(resp, options, complete, status);
            }
        });
    }
    attempt();
}

function onResult(resp, options, complete, preStatus) {
    resp = resp || {};
    try {
        $log.info('Qwen TTS 响应 keys=' + Object.keys(resp).join(',') + ', dataType=' + (typeof resp.data));
        var rawLen = resp.rawData && resp.rawData.length !== undefined ? resp.rawData.length : -1;
        var dataLen = resp.data && resp.data.length !== undefined ? resp.data.length : -1;
        $log.info('Qwen TTS 音频长度: rawData=' + rawLen + ', data=' + dataLen);
    } catch (error) {}

    if (resp.error) {
        complete({
            error: createApiError(
                '请求服务器失败',
                resp.error.message || JSON.stringify(resp.error)
            )
        });
        return;
    }

    var statusCode = resp.response ? resp.response.statusCode : 0;
    if (statusCode && (statusCode < 200 || statusCode >= 300)) {
        try {
            $log.error('Qwen TTS 请求失败（HTTP ' + statusCode + '）: ' + responseBodySnippet(resp));
        } catch (error) {}
        complete({
            error: createApiError('请求失败（HTTP ' + statusCode + '）', responseBodySnippet(resp))
        });
        return;
    }

    // Bob 会尝试把返回值解析为 JSON（WAV 解析失败会打一条日志，可忽略）；
    // 二进制原字节在 rawData，必须优先使用；resp.data 是 JSON 解析产物，头部已损坏，会导致播放开头被截断。
    var status = preStatus || audioStatus(resp.rawData || resp.data, options.responseFormat);

    if (status.state === 'empty') {
        complete({
            error: createApiError('服务器未返回音频数据', 'model=' + options.model + ', voice=' + options.voice)
        });
        return;
    }

    if (status.state === 'broken') {
        $log.error('Qwen TTS 音频数据处理失败: ' + status.message);
        complete({
            error: createApiError('音频数据处理失败', status.message)
        });
        return;
    }

    if (status.state === 'incomplete') {
        $log.error('Qwen TTS 音频下载不完整: 已接收 ' + status.actual + ' / 应为 ' + status.expected + ' 字节');
        complete({
            error: createApiError('音频下载不完整，请重试', '已接收 ' + status.actual + ' / 应为 ' + status.expected + ' 字节')
        });
        return;
    }

    complete({
        result: {
            type: 'base64',
            value: status.b64,
            raw: { model: options.model, voice: options.voice }
        }
    });
}

function readOptions(queryLang) {
    return {
        baseUrl: optionText('baseUrl', 'http://127.0.0.1:8000'),
        apiKey: optionText('apiKey', ''),
        model: optionText('model', 'mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit'),
        voice: optionText('voice', 'Serena'),
        langCode: resolveLangCode(queryLang),
        instruct: readInstruct(),
        temperature: clampFloat($option.temperature, 0.8, 0, 2),
        topP: clampFloat($option.topP, 0.95, 0, 1),
        topK: clampInteger($option.topK, 50, 0, 100),
        repetitionPenalty: clampFloat($option.repetitionPenalty, 1.05, 1.0, 2.0),
        maxTokens: clampInteger($option.maxTokens, 2400, 1, 8192),
        responseFormat: optionText('responseFormat', 'wav'),
        timeout: pluginTimeoutInterval()
    };
}

function tts(query, completion) {
    var text = query.text || '';
    if (!text.trim()) {
        completion({ error: { type: 'param', message: '合成文本不能为空' } });
        return;
    }

    if (!lang.isSupported(query.lang)) {
        completion({
            error: {
                type: 'unsupportLanguage',
                message: '不支持的语言: ' + query.lang
            }
        });
        return;
    }

    var options = readOptions(query.lang);
    if (!options.baseUrl) {
        completion({
            error: { type: 'param', message: '请在插件配置中填写服务地址 (Base URL)' }
        });
        return;
    }
    if (!options.model) {
        completion({
            error: { type: 'param', message: '请在插件配置中填写模型' }
        });
        return;
    }
    if (!options.voice) {
        completion({
            error: { type: 'param', message: '请在插件配置中填写音色 (voice)' }
        });
        return;
    }

    synthesize(text, options, completion);
}

function pluginTimeoutInterval() {
    return clampInteger($option.timeout, 60, 30, 300);
}

function pluginValidate(completion) {
    var options = readOptions('zh-Hans');
    if (!options.baseUrl) {
        completion({
            result: false,
            error: { type: 'param', message: '请填写服务地址 (Base URL)' }
        });
        return;
    }

    options.maxTokens = 200;
    options.timeout = 30;
    synthesize('你好', options, function (response) {
        if (response.error) {
            completion({ result: false, error: response.error });
            return;
        }
        completion({ result: true });
    });
}

exports.supportLanguages = supportLanguages;
exports.tts = tts;
exports.pluginTimeoutInterval = pluginTimeoutInterval;
exports.pluginValidate = pluginValidate;
