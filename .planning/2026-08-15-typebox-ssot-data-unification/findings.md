# Findings: TypeBox SSOT 数据归一化

## 项目现状分析

### 数据结构多层维护问题
当前项目存在 6 层数据结构需要手动保持一致：
1. SQL Schema（migrations/*.sql）
2. 服务端 Row Types（*.types.ts）
3. 服务端 API Schema（*.schemas.ts - TypeBox）
4. 服务端 Repository（手写 SQL）
5. 客户端 DB Types（Kysely 表接口）
6. 业务模型类（Struct + 装饰器）

**痛点：** 任何 schema 变更需要手动更新 6 个地方，容易出错且维护成本高。

---

## 技术栈现状

### 服务端（packages/server）
- **数据库：** Cloudflare D1（SQLite 兼容）
- **验证：** Elysia + TypeBox（已在使用）
- **查询：** 手写 SQL（通过 D1 Database API）
- **表数量：** 13 张
- **代码量：** ~822 行 Repository + ~400 行 Schemas

### 客户端（packages/db）
- **数据库：** Tauri SQLite / Web WASM SQLite
- **查询构建器：** Kysely（已在使用）
- **表数量：** 9 张
- **代码量：** ~300 行类型定义 + 查询逻辑

### Rust 侧（packages/downloader）
- **数据库：** 独立 SQLite（与服务端完全隔离）
- **ORM：** SQLx
- **表数量：** 9 张（独立 schema）
- **数据库 struct：** 7 个
- **结论：** 不需要与 TypeScript 数据结构同步

---

## JSON 列使用分析

### 服务端 D1（9 个 JSON 列）
| 表 | JSON 列 | 用途 | 类型复杂度 |
|---|---|---|---|
| sync_entities | data_json | 同步实体数据 | 中 |
| sync_changes | data_json | 同步变更数据 | 中 |
| server_plugin_registry | manifest_json | 插件清单 | 高 |
| server_plugin_registry | config_json | 插件配置 | 中 |
| server_plugin_registry | last_health_json | 健康检查 | 低 |
| server_plugin_jobs | result_json | 任务结果 | 中 |
| server_plugin_audit | detail_json | 审计详情 | 低 |
| server_plugin_script_runs | input_json | 脚本输入 | 中 |
| server_plugin_script_runs | result_json | 脚本输出 | 中 |

### 客户端 Kysely（4 个 JSON 列）
| 表 | JSON 列 | 类型 | 用途 |
|---|---|---|---|
| itemStore | item | JSONColumnType\<UniItemRaw\> | 漫画条目数据 |
| history | ep | JSONColumnType\<UniEpRaw\> | 章节数据 |
| plugin | meta | JSONColumnType\<Meta\> | 插件元数据 |
| subscribe | author | JSONColumnType\<UniItemAuthor\> | 作者信息 |

**发现：** JSON 列占比高（服务端 69%，客户端 44%），TypeBox 天然支持 JSON Schema，比 Drizzle 更适合。

---

## 方案对比分析

### 方案 1：TypeBox SSOT（推荐）
**工作量：** 15-22 天（3-4 周）

**优势：**
1. ✅ 保留 Kysely - 客户端 ~300 行查询代码不动
2. ✅ 保留 TypeBox - 服务端验证代码保留
3. ✅ 增量迁移 - 可以逐模块迁移
4. ✅ JSON 列友好 - TypeBox 是 JSON Schema 标准
5. ✅ 运行时验证 - TypeBox.Value.Check() 内置
6. ✅ 轻量级 - 适合 Cloudflare Workers

**劣势：**
1. ⚠️ 需要开发代码生成工具（一次性工作）
2. ⚠️ Rust 代码生成需要额外脚本（但 Downloader 不需要）

---

### 方案 2：Drizzle ORM（不推荐）
**工作量：** 27-38 天（5-7 周）

**优势：**
1. ✅ 最成熟的 TypeScript ORM
2. ✅ 官方支持 Cloudflare D1
3. ✅ 自动生成 migration
4. ✅ 类型完全自动推导

**劣势：**
1. ❌ 推倒重来 - 客户端 + 服务端都要重构
2. ❌ 放弃 Kysely - ~300 行查询代码需要重写
3. ❌ 学习成本 - 团队需要学习新 API
4. ❌ JSON 列复杂 - Drizzle 的 JSON 处理不如 TypeBox 直观
5. ❌ 无法增量 - 要么全用 Drizzle，要么全用 Kysely
6. ⚠️ 验证层 - 需要集成 Drizzle-Zod 或保留 TypeBox 双重验证

---

## 试点表选择：auth_users

**为什么选这张表：**
1. ✅ 结构简单 - 8 个字段，无外键
2. ✅ 无 JSON 列 - 先验证基础类型
3. ✅ 有现成 TypeBox schema - auth.schemas.ts 已定义部分字段
4. ✅ 代表性强 - 典型的用户表结构
5. ✅ 测试简单 - 可以快速验证端到端流程

**auth_users 表结构：**
```sql
CREATE TABLE auth_users (
  id TEXT PRIMARY KEY NOT NULL,
  login_name TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_alg TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  disabled_at INTEGER
);
```

**现有 TypeBox 定义（部分）：**
```typescript
// auth.schemas.ts 已有部分字段
export const meResponseSchema = t.Object({
  user: t.Object({ 
    id: t.String(), 
    loginName: t.String() 
  }),
  // ...
})
```

---

## 技术实现路径

### TypeBox → SQL 生成器
**核心逻辑：**
```typescript
TypeBox Schema
  ↓
解析 Type.* 定义
  ↓
映射到 SQL 类型
  ↓
生成 CREATE TABLE DDL
```

**类型映射表：**
| TypeBox | SQL (SQLite) | 注释 |
|---------|--------------|------|
| Type.String() | TEXT | |
| Type.Integer() | INTEGER | |
| Type.Number() | REAL | |
| Type.Boolean() | INTEGER | 0/1 |
| Type.Optional() | NULL-able | |
| Type.Object() | TEXT (JSON) | JSONColumnType |
| Type.Array() | TEXT (JSON) | JSONColumnType |

---

### TypeBox → Kysely 生成器
**核心逻辑：**
```typescript
TypeBox Schema
  ↓
解析字段定义
  ↓
生成 interface Table
  ↓
处理 Generated/Optional
```

**生成示例：**
```typescript
// 输入：TypeBox Schema
const AuthUserSchema = Type.Object({
  id: Type.String(),
  login_name: Type.String(),
  created_at: Type.Integer(),
  disabled_at: Type.Optional(Type.Integer()),
})

// 输出：Kysely 类型
export interface AuthUsersTable {
  id: string
  login_name: string
  created_at: number
  disabled_at: number | null
}
```

---

## 风险评估

### 高风险项
1. **JSON 列类型推导** - 复杂嵌套类型可能难以正确生成
2. **外键约束** - 需要额外元数据标注
3. **索引定义** - TypeBox 没有原生索引概念
4. **Migration 兼容性** - 生成的 SQL 需要与现有 migration 兼容

### 缓解措施
1. **分阶段实现** - Phase 0 只处理基础类型
2. **对比验证** - 生成的 SQL 与现有 migration 逐行对比
3. **增量迁移** - 逐表迁移，出问题可回滚
4. **保留手动 escape hatch** - 复杂类型可以手动标注

---

## 参考资料

### TypeBox 核心 API
- `Type.Object()` - 对象定义
- `Type.String({ format, minLength, maxLength })` - 字符串约束
- `Type.Integer()` - 整数
- `Type.Optional()` - 可选字段
- `Type.Static<typeof Schema>` - 类型推导
- `Value.Check(Schema, data)` - 运行时验证

### Kysely 核心类型
- `Selectable<Table>` - 查询返回类型
- `Insertable<Table>` - 插入类型
- `Updateable<Table>` - 更新类型
- `Generated<T>` - 自动生成字段（如主键）
- `JSONColumnType<T>` - JSON 列类型

### Cloudflare D1 限制
- SQLite 3.x 语法
- 不支持某些高级特性（如 GENERATED COLUMN）
- 单次查询最大 1MB
- 批量操作限制

---

## 待解决问题

1. **外键约束如何在 TypeBox 中表达？**
   - 方案：自定义 `Foreign()` 辅助函数
   - 或：在生成器中通过额外配置指定

2. **索引定义如何处理？**
   - 方案：分离的索引配置文件
   - 或：TypeBox schema 的 metadata 字段

3. **复合主键如何处理？**
   - 方案：在生成器中支持 `primaryKey: ['col1', 'col2']` 配置

4. **Kysely Generated 类型如何自动推导？**
   - 方案：识别主键字段自动加 Generated<>
   - 或：通过 TypeBox metadata 标注

5. **是否需要双向同步（SQL → TypeBox）？**
   - 当前方案：单向（TypeBox → SQL）
    - 理由：TypeBox 是 SSOT，SQL 只是生成产物

## Phase 3 运行时验证结论
- TypeBox 1.x 的 `Value.Errors` 使用 `instancePath`，旧 `@sinclair/typebox/value` 使用 `path`；两套包不能在 Elysia schema 边界混用。
- 数据库读取 schema 必须把 `Optional` 列转换为必需但可为 `null` 的字段，因为 SQLite 查询行总是带有列名。
- 数据库写入需要区分完整 row、局部 update patch 和自增列 insert，统一 schema 直接复用会错误拒绝合法写入。
- `Compile(schema)` 通过 `WeakMap` 缓存后用于高频 Repository 边界；错误详情只保留前 5 个字段错误。

---

## 成功标准

### Phase 0 成功标准
- [ ] auth_users 的 TypeBox schema 完整定义
- [ ] 生成的 SQL DDL 与现有 0001_auth.sql 一致
- [ ] 生成的 Kysely 类型可用于查询
- [ ] 用 Kysely 重写至少 1 个 auth.repository.ts 的查询
- [ ] 类型推导正确（无 `any`，无类型断言）

### 最终成功标准（Phase 5）
- [ ] 所有 22 张表（服务端 13 + 客户端 9）迁移完成
- [ ] 所有 Repository 层使用 Kysely（无手写 SQL）
- [ ] 关键路径有运行时验证
- [ ] 端到端测试通过
- [ ] 性能无退化
- [ ] 开发文档完整

---

## typebox 1.x 包迁移记录（2026-08-15）

### 包名变更（skill 指导）
- `@sinclair/typebox` 已弃用 → 新包名 `typebox`（当前 1.3.14）
- 子路径：`typebox/compile`（Compile）、`typebox/value`（Value）、`typebox/guard`（JS 值守卫，非 schema 守卫）
- catalog 增加 `typebox: ^1.3.14`，根 devDependencies 已切换

### API 变更（codegen 已适配）
| 0.34 | 1.x | 说明 |
|------|-----|------|
| `TypeGuard.IsString(schema)` 等 schema 级守卫 | **不存在**，改用 `schema.type === 'string'` | TSchema 的 `type` 字段：'string'/'integer'/'number'/'boolean'/'object'/'array' |
| `TypeGuard.IsUnion(schema)` | 顶层 `IsUnion(schema)` | 仍从 `typebox` 主入口导出 |
| `TypeGuard.IsOptional(schema)` | 顶层 `IsOptional(schema)` | `TOptional` 仍是交叉类型 `Type & { [OptionalKind] }`；JSON 形状无差异（Optional 信息在内部符号） |
| `Static<TOptional<T>>` | 不变 | 仍为 `T \| undefined`，TableRow 推导逻辑无需改 |
| `Type.UnionEnum` | 不存在（0.34 也没有） | 用 `Type.Union([...Type.Literal])`，schema 形状 `anyOf[].const` 兼容 |

### 服务端（Phase 1 处理）
- `packages/server/app/shared/response.ts`：`TSchema` 类型导入
- `packages/server/app/modules/plugins/plugins.manifest.ts`：`Value` from '@sinclair/typebox/value'
- Elysia 1.4.29 通过 `exact-mirror` 适配多 schema 库（pnpm store 已有 typebox 1.x 适配版），迁移时需验证 Elysia `t` 对象与新包 schema 的互操作

## Phase 5 基线（2026-08-16）
- 工作树干净，P4 相关提交已落在当前分支。
- 仓库要求使用 Vite+ `vp`；完整 Web 验证顺序为 `vp run lib-build`、`vp check`、`vp run -r typecheck`、`vp test run`。
- P5 需区分迁移相关失败与既有 workspace 类型/环境失败，并把精确命令和结果写入 progress.md。
- 客户端数据库适配器通过 `SerializePlugin` 将 SQLite 布尔列还原为 `boolean`；TypeBox schema 仍生成 SQLite `INTEGER`，Kysely 生成器增加表级 `kyselyBoolean` 选项保持业务类型与数据库类型分离。
- 全 workspace typecheck 的现存阻塞集中在 `packages/app` favourite/subscribe 视图（26 errors），与 P5 触及的 codegen、packages/db 和 packages/server 无引用关系；该基线在 Phase 3/2 记录中已存在。
- 性能回归只能建立当前基线：codegen 约 4.93s，consistency check 约 1.77s，关键 Repository/validation 测试约 2.72s；缺少 Phase 0 前的同机 benchmark，无法做严格前后百分比比较。
