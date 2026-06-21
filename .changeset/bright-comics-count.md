---
"@delta-comic/model": major
"@delta-comic/utils": major
"@delta-comic/db": major
"@delta-comic/ui": major
"@delta-comic/plugin": major
---

统计 `1.3.0..HEAD` 的 133 个提交并迁移到 Changesets。

- 提交类型统计：43 个 chore、28 个 refactor、20 个 fix、17 个 ci、11 个 feat、7 个 docs、4 个 style、2 个 pref、1 个 test。
- Breaking change：插件底层和插件运行时架构重构，旧插件需要适配新架构；数据库、utils 改为 Tauri 插件集成，构建和发布链路整体重构。
- Features：新增 WebView 鉴权、插件内容下载解析、list stream 模式、响应式数据库系统、`@pinia/colada` 集成、UI 导航优化、popup 改进、npm/GitHub Packages 发布链路和 Changesets 迁移。
- Fixes：修复路由类型、UI 构建类型、peer 依赖混乱、temp 卡死、image retry、数据库初始同步、循环依赖、更新预版本判断、构建发布流程等问题。
- Refactors：迁移 Vite+ 技术栈，整合 monorepo，重构 model/plugin/db/ui 架构，调整插件构建与加载、插件安装、构建流程和依赖 catalog。
- Maintenance：补齐 plugin/utils 测试，更新文档、CI、项目索引和发布配置。
