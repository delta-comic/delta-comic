# 任务清单

你现在着手完成以下内容，不分先后。你自己决定工作顺序

此外，你可以**任意的**添加依赖和增删monorepo

适当的用git提交(不推送)保存分割工作进度

你可以切分子任务来更好的规划进度

该清单内容位于`项目根目录/TODOS.md`

---

## TS 类型约束治理（按 AGENTS.md 最后几条规则）

按「二 → 一 → 三」顺序完成：先零破坏小修，再做破坏性小改，最后评估破坏性重构。

### 二、生产代码中的 `as any` / 裸 `any`

- [ ] #4 `packages/db/lib/config.ts:45` `upsertConfig(..., form: any)` → `form: ConfigDescription`
- [ ] #5 `packages/db/lib/{favourite,history,plugin,recentView,subscribe}.ts` `otherKeys: any[]` → colada `Key[]`（5 处）
- [ ] #6 `packages/db/lib/utils.ts:31` `countDb(SelectQueryBuilder<DB, any, object>)` → `SelectQueryBuilder<DB, keyof DB, object>`
- [ ] #7 `packages/ui/src/router.ts:29` `router.resolve(to as any)` → `to: RouteLocationRaw`
- [ ] #8 `packages/ui/lib/message/download.tsx:262` 循环赋值 → `Object.assign(_config, config)`；`PromiseWithResolvers<any>`(L59) 收窄
- [ ] #9 `packages/app/src/cloud/syncAdapter.ts:65,69` `(trx as never)`/`(trx as any)` → `switch (change.collection)` 分发，`deleteRemoteChange` 参数改 `Kysely<DB>`
- [ ] #10 `packages/model/lib/model/{item,comment}.ts` `Promise<any>`/`PromiseLike<any>` → `Promise<unknown>`/`PromiseLike<unknown>`
- [ ] #11 `packages/model/lib/model/item.ts:55-56` `class?: any; style?: any` → 精确类型；`content.ts:22-27` Component 的 `any` → `{}`，`view(): any` → `unknown`
- [ ] #12 `packages/model/lib/struct/meta.ts:8` `Metadata = Record<string|number, any>` → `Record<string|number, unknown>`（检查 `$$meta` 读取侧）
- [ ] #13 `packages/model/lib/struct/store.ts:68` `forEach(thisArg?: any)` → `unknown`
- [ ] #14 `packages/plugin/lib/api/model/user.ts:65` `call(author): any` → `unknown`
- [ ] #15 `packages/plugin/lib/adapters/configStore.ts:25` `data: store as any` → 验证泛型链路后删断言，必要时单断言收敛
- [ ] #16 `packages/ui/lib/components/DcMarkdown/index.vue:24` `{ plugins: [] as any, config: {} as any }` → 直接删
- [ ] #17 `packages/ui/lib/components/form/components/DcForm.vue:19,37` `Record<string, any>`/`config as any` → `FormDefaultValue[keyof FormDefaultValue]` 等精确类型
- [ ] #18 `packages/ui/lib/components/form/components/DcFormItem.vue:16` `ModelRef<any>` → 用推导类型或 `ModelRef<FormSingleResult<T>>`
- [ ] #19 `packages/logger/lib/logger.ts:155` `previous as never` → `as (typeof console)[typeof method]`
- [ ] #20 `packages/plugin/lib/api/config.ts:12` 幽灵字段 `_type = {} as T` → `declare readonly _type: T`

### 一、`as unknown as` 强制转换

- [x] #1 `packages/model/lib/struct/struct.ts:21` `return item as any` → 单点诚实断言 `item as T & TRaw`（tsgo 下 `as TRaw` 不可比）
- [x] #2 `packages/plugin/lib/kernel/contribution.ts:101` `as unknown as` → 新增擦除接口 `AnyContributionRegistry`，创建/返回各一个单层 `as`（56/69/76 行条件断言保留，属于 per-owner 收窄设计）
- [x] #3 `packages/plugin/vite/index.ts:95` + `packages/server/app/shared/http/cors.ts:10` → plugin 新增 `vite`(catalog) 依赖改用官方 `Plugin`/`PluginOption`；cors.ts 删除，内联 `.use(elysiaCors({...}))`

### 三、Module Augmentation 优化

- [x] #21 `packages/utils/lib/env.ts` → 暴露 `AppApiRegistry`/`AppLibRegistry` 可增强接口；app 端 Module Augmentation 注册 M3 与 10 个 UMD 库类型；`$$lib$$` 值类型 `any` → `unknown`（var.ts 保留 `??=` 初始化并单点 `as T`）
- [x] #22 删除 ui/env.d.ts 与 app/src/env.d.ts 重复的 vue-router TypesConfig/RouterClassic 声明，utils 经 dist 输出为唯一事实源（app 保留 vue ComponentCustomProperties 与 vue-i18n）

### 五、测试代码批量清理（低优先，单独 PR）

- [ ] #23 `db/test/lib/operations.test.ts`（~30 处 `as never`）、`ui/test`、`server/test` 的 mock：类型化 mock 工厂 + `vi.fn<T>()`，单断言替代 `as unknown as`