/**
 * Bob 语言代码映射
 * Qwen TTS 服务使用 lang_code（如 Chinese / English），与 Bob 语言代码不同，
 * 因此这里维护一张映射表；用户在插件设置中填写 langCode 可强制覆盖自动映射。
 */

// [Bob语言代码, 说明]
var supportLanguages = [
    ['zh-Hans', '中文简体'],
    ['zh-Hant', '中文繁体'],
    ['en', '英语'],
    ['ja', '日语'],
    ['ko', '韩语'],
    ['fr', '法语'],
    ['de', '德语'],
    ['es', '西班牙语'],
    ['pt', '葡萄牙语'],
    ['id', '印尼语']
];

// Bob 语言代码 → Qwen lang_code
// 注意：服务端目前只有一个中文取值，zh-Hant 刻意回退到 Chinese。
var bobToQwenLang = {
    'zh-Hans': 'Chinese',
    'zh-Hant': 'Chinese',
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'pt': 'Portuguese',
    'id': 'Indonesian'
};

// 创建 Set 用于快速查找
var langSet = {};
for (var i = 0; i < supportLanguages.length; i++) {
    langSet[supportLanguages[i][0]] = true;
}

/**
 * 检查是否支持该语言
 * @param {string} lang Bob 语言代码
 * @returns {boolean}
 */
function isSupported(lang) {
    return langSet[lang] === true;
}

/**
 * Bob 语言代码转 Qwen lang_code，未知语言回退到 Chinese
 * @param {string} bobLang Bob 语言代码
 * @returns {string} Qwen lang_code
 */
function toQwenLangCode(bobLang) {
    return bobToQwenLang[bobLang] || 'Chinese';
}

exports.supportLanguages = supportLanguages;
exports.isSupported = isSupported;
exports.toQwenLangCode = toQwenLangCode;
