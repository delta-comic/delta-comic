(function () {
  // 1. 保存原始句柄
  const _originalJSONParse = JSON.parse

  JSON.parse = function (text, reviver) {
    // 如果不是字符串，直接交给原函数处理（原函数会处理 null/undefined/number 等）
    if (typeof text !== 'string') {
      return _originalJSONParse.apply(JSON, text)
    }

    try {
      // 2. 首先尝试使用原生的最高效解析
      return _originalJSONParse.call(JSON, text, reviver)
    } catch (e) {
      // 3. 只有在报错且是字符串时，才进入修复逻辑
      if (e instanceof SyntaxError) {
        let fixedText = text

        // 修复逻辑 A：去除不可见的 Unicode 控制字符和特殊空格
        // \u00A0 是你遇到的不间断空格，\uFEFF 是 BOM 头，等等
        fixedText = fixedText.replace(/[\u00A0\u1680\u200b\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/g, " ")

        // 修复逻辑 B：处理"Unexpected non-whitespace character after JSON"
        // 找到最后一个有效的 JSON 闭合符号 ( } 或 ] )，截断后面的垃圾字符
        const lastBrace = fixedText.lastIndexOf('}')
        const lastBracket = fixedText.lastIndexOf(']')
        const lastValidIndex = Math.max(lastBrace, lastBracket)

        if (lastValidIndex !== -1) {
          fixedText = fixedText.substring(0, lastValidIndex + 1)
        }

        // 修复逻辑 C：去除首尾可能存在的普通空白符
        fixedText = fixedText.trim()

        return _originalJSONParse.call(JSON, fixedText, reviver)
      }
      throw e // 非 SyntaxError 原样抛出
    }
  }

  // 修补 Response.prototype.json 方法
  Response.prototype.json = function () {
    return this.text().then((text) => JSON.parse(text))
  }
})()


window.process = {
  env: import.meta.env
} as any // 强兼zip模式打包

window.$api = {}
window.$layout = {}
window.$$safe$$ = false;
(window.$$lib$$ as any) = {}