#!/bin/bash

# 定义目标文件
PACKAGE_FILE="package.json"

# 1. 检查文件是否存在
if [ ! -f "$PACKAGE_FILE" ]; then
  echo "❌ 错误: 当前目录下未找到 $PACKAGE_FILE"
  exit 1
fi

echo "🔍 正在读取 $PACKAGE_FILE ..."

# 2. 使用 Node.js 处理 JSON (这是最安全的方法)
# 我们将 Node代码作为字符串传递给 'node -e' 执行
node -e "
const fs = require('fs');
const fileName = '$PACKAGE_FILE';

try {
  // 读取并解析 JSON
  const data = fs.readFileSync(fileName, 'utf8');
  const json = JSON.parse(data);

  // 添加或更新 overrides 中的条目
  json.overrides ??= {}
  json.overrides['delta-comic-core'] = 'latest';
  json.pnpm ??= {};
  json.pnpm.overrides ??= {};
  json.pnpm.overrides['delta-comic-core'] = 'latest';

  // 更新 dependencies 中的 delta-comic-core
  if (json.dependencies && json.dependencies['delta-comic-core']) {
    json.dependencies['delta-comic-core'] = 'latest';
  }

  // 写回文件，使用 2 个空格缩进格式化
  fs.writeFileSync(fileName, JSON.stringify(json, null, 2) + '\n');
  
  console.log('✅ 成功: 已添加 delta-comic-core 到 overrides 字段，并更新 dependencies 版本。');

} catch (error) {
  console.error('❌ 失败: 处理 JSON 时发生错误:', error.message);
  process.exit(1);
}
"

# 检查 Node.js 命令的执行状态
if [ $? -eq 0 ]; then
  echo "🎉 操作完成！"
else
  echo "⚠️ 脚本执行失败。"
fi