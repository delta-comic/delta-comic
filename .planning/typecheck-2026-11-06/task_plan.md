# 全仓 Typecheck 修复

## 目标

修复新包更新导致的全仓 TypeScript 类型错误，保持现有 API 和运行时行为。

## 阶段

- [complete] 运行全仓 typecheck，收集错误
- [complete] 按错误根因修复受影响包
- [complete] 重新运行全仓 typecheck 和相关验证
- [in_progress] 检查 diff 并提交

## Next Step

核对 diff 后提交修复。

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| admin panel Vue template reported missing `value` on store/computed template types (11 diagnostics) | 1 | use `storeToRefs` and destructure store action in `SettingsPage.vue`; read static i18n text in script |

