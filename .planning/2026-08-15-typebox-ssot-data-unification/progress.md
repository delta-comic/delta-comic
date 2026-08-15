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
