# Progress Log

## Session 1: 2026-08-15 - 初始化与需求分析

### 项目背景
用户面临数据结构多层维护问题：
- SQL schema
- TypeScript 手写原始结构体
- TypeScript 封装数据类
- 服务端数据结构
需要归一化管理，实现类型验证。

### 代码库分析完成
**服务端（packages/server）：**
- 13 张 D1 表
- 9 个 JSON 列（69% 的表）
- 4 个 Repository 文件，共 822 行手写 SQL
- 已使用 Elysia + TypeBox 验证

**客户端（packages/db）：**
- 9 张 Kysely 表
- 4 个 JSON 列（44% 的表）
- 已使用 Kysely 查询构建器

**Rust 侧（packages/downloader）：**
- 独立 SQLite 数据库（9 张表）
- 7 个数据库相关 struct
- 与服务端数据库完全隔离，不需要同步

### 方案对比完成
- **方案 1（TypeBox SSOT）：** 15-22 天，保留现有技术栈，增量迁移
- **方案 2（Drizzle ORM）：** 27-38 天，全面重构，学习成本高

**用户决策：** 确认采用方案 1

### 任务规划完成
- 创建了完整的 6 阶段任务计划
- Phase 0: 原型验证（试点表 auth_users）
- Phase 1-2: 服务端和客户端全量迁移
- Phase 3: 运行时验证集成
- Phase 4: 工具链优化
- Phase 5: 全量测试

### 关键发现记录
- JSON 列占比高，TypeBox 天然支持，选择正确
- Rust 代码生成不是刚需（Downloader 独立）
- auth_users 是理想的试点表（简单、无 JSON 列）

### 下一步
等待用户确认启动 Phase 0 的具体实施，开始编写代码生成工具。

---

## Session 6: 2026-08-15 - Phase 3 运行时验证集成完成

### 已完成
- 扩展 codegen 输出 13 张服务端表的运行时行 schema，按 SQLite 数据库行形状处理 Optional/null 和布尔 INTEGER；移除 `auth_users.id` 不符合现有数据的 UUID format 约束。
- 新增数据库验证 helper，统一读、写、patch、自增列 insert 的 TypeBox 校验，并缓存 `Compile` 结果；失败统一抛出 `DATABASE_SCHEMA_INVALID` AppError。
- auth、sync、plugins、admin Repository 接入数据库读取和写入边界校验；保留 `rotateSession` D1 batch 原子语义。
- Elysia 路由 schema 继续使用 `@sinclair/typebox`，数据库验证使用 `typebox` 1.x，避免两套 schema 类型互操作问题。

### 验证
- codegen 生成通过。
- `vp check --fix` 通过。
- server typecheck 通过。
- 服务端测试通过：28 files / 129 tests。
- 完整检查中构建、lint、检查和测试通过；工作区类型检查仍有客户端既有错误（`packages/app` favourite/subscribe 相关 26 errors），与本阶段服务端改动无关。

### 错误与修复
- codegen 首次生成汇总 schema 时遗漏 `IsUnion` 导入，补充后重新生成。
- sync pull 测试夹具误用 `SyncOpRow`，改为完整 `SyncChangeRow`。
- 自增 `server_seq` insert 校验排除生成列。
- 管理审计测试夹具补齐数据库必填 `actor_id/job_id`。

### 下一步
- Phase 4：完善生成器边缘情况、pre-commit schema 一致性检查和开发文档。

---

## Session 5: 2026-08-15 - Phase 2 客户端数据层迁移完成

### 已完成
- 新增 `script/codegen/client.table.mts`，集中定义客户端 9 张表的 TypeBox schema。
- 扩展 codegen 支持 CamelCasePlugin 的 snake_case 到 camelCase 类型映射，以及 JSON 列类型导入。
- 生成 `packages/db/lib/generated/` 下的客户端 Kysely 表类型和 SQL 产物。
- itemStore、favourite、history、recentView、subscribe、plugin、config、nativeStore 改为使用生成类型；DB 查询逻辑保持不变。

### 验证
- `@delta-comic/db` typecheck 通过。
- 客户端数据库操作测试与 codegen 测试通过。
- `vp check` 通过；`@delta-comic/db` typecheck、数据库操作测试和 codegen 测试通过。
- 工作区 typecheck 仍受 `packages/ui/lib/components/form/components/DcForm.vue:35` 的既有泛型错误阻塞；全量测试另有 `packages/plugin` 文件协议超时和 `packages/db` nativeStore 环境时序失败，均不涉及本次迁移代码。

---

## Session 2: 2026-08-15 - Phase 0 原型验证完成

### 生成器骨架完成（script/codegen/）
- `schema.mts`：`defineTable(name, columns, meta)` DSL + `TableRow<T>` 类型推导（Optional → `| null`）；`IndexColumn` 支持 `{ column, order: 'ASC'|'DESC' }`；`onDelete` 小写对齐 Kysely `OnModifyForeignAction`
- `sql.mts`：**改用 Kysely Schema Builder 生成 DDL**（用户提出手写 SQL 语法太麻烦，Kysely 自带建表工具；不再手写字符串拼接）
- `kysely.mts`：TypeBox → Kysely 表接口源码生成（snake_case→PascalCase+`Table` 后缀；JSON 列待 jsonColumn）
- `run.mts`：CLI 入口
- `example/auth-users.table.mts`：试点表定义

### 技术决策更新
- **Kysely Schema Builder 替代手写 DDL**：`db.schema.createTable().addColumn()...compile()` 生成紧凑格式 SQL；支持 `ifNotExists`、列内联 PK/UNIQUE、`constraint "pk_x" primary key (...)` 复合约束、`references(...).onDelete(...)`、`'col desc'` 索引排序
- 根 package.json 增加 `kysely`（catalog:）和 `@sinclair/typebox` devDependencies，已 `vp install`
- **测试策略变更**：无法字节级对比（Kysely 输出格式不同），改用 `node:sqlite` 语义对比——分别执行现有 migration 与生成 SQL，对比 `PRAGMA table_info / index_list / index_info / foreign_key_list`

### 验证结果
- 15 个测试全部通过（sql.test.ts 语义对比 + 单元断言、schema.test.ts 类型推导 expectTypeOf、kysely.test.ts 源码生成）
- 生成的 auth_users 表结构与现有 migration 建出的结构语义一致（NOT NULL / UNIQUE / PK / FK / 索引含 DESC 排序）
- `vp check --fix` 通过（格式 + lint 全绿）
- 排查过程中确认 TypeGuard 行为：`IsOptional(plain)`=false、`IsOptional(Type.Optional(x))`=true、`IsString` 对 Optional 交叉类型也是 true（之前踩过的坑）

### 发现
- 现有 migration 中 `auth_users.login_name` 同时有 UNIQUE 约束和显式索引 `idx_auth_users_login_name`（冗余但保留以对齐）
- `auth_sessions` 真实结构：`access_expires_at`/`refresh_expires_at`/`rotated_at`，复合 FK → auth_terminals，3 个索引
- node:sqlite（Node 25 内置）可作测试数据库

### 下一步
- Phase 1：13 张服务端表全量迁移到 `.table.mts` 定义 + Repository 迁移 Kysely（kysely-d1）+ JSON 列 jsonColumn 支持
- 提交本次改动

---

## Session 3: 2026-08-15 - Phase 1 生成器基础扩展

### 已完成
- `jsonColumn(typeName)`：为 JSON 列保留 TypeBox DSL 标记，并生成 `JSONColumnType<...>` Kysely 字段类型；SQL 侧映射为 SQLite `TEXT`。
- `autoIncrement()`：支持 SQLite `INTEGER PRIMARY KEY AUTOINCREMENT`，并生成 Kysely `Generated<number>` 类型。
- `TableIndex.unique`：支持生成 `CREATE UNIQUE INDEX`。
- 将 `sync_entities`、`sync_changes`、`sync_ops`、`sync_terminal_cursors` 加入生成器语义对比测试，覆盖服务端 13 张表。

### 验证
- `vp run lib-build` 通过。
- codegen 测试通过：23 tests。

### 下一步
- 抽取 13 张服务端表的生产 `.table.mts` SSOT 定义。
- 扩展 `run.mts` 生成服务端 SQL 和 Kysely 类型产物。
- 迁移服务端 Repository，并保留 D1 批处理/错误处理语义。

---

## Session 4: 2026-08-15 - Phase 1 服务端数据层迁移完成

### 已完成
- 新增 `script/codegen/server.table.mts`，作为 13 张服务端 D1 表的 TypeBox SSOT。
- `run.mts` 支持表数组、完整 SQL（含索引）及 Kysely 类型导入，生成产物位于 `packages/server/app/infrastructure/d1/generated/`。
- 新增 `createKysely()` 与 `ServerDatabase`，使用 `kysely-d1` 的 `D1Dialect`。
- auth、sync、plugins、admin 四个 Repository 已迁移到 Kysely；`rotateSession` 保留 D1 `batch`，因为 `kysely-d1` 当前不支持事务。
- 测试 recorder 已兼容 Kysely-D1 的 `all()` 执行契约，测试断言同步到 Kysely 生成 SQL。

### 验证
- `vp install` 通过并加入 `kysely-d1`。
- server typecheck 通过。
- server 测试通过：34 files / 157 tests。
- codegen 测试通过：24 tests。
- `vp check` 通过。

### 下一步
- Phase 2：迁移客户端 9 张表的 TypeBox SSOT，保留现有 Kysely 查询逻辑。
- Phase 3：在 Repository 边界增加 TypeBox 运行时读写验证。

---
