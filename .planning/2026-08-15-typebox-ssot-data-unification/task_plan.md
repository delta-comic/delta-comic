# Task Plan: TypeBox 作为单一数据源的数据结构归一化

## Goal
将 SQL schema、TypeScript 类型、服务端验证、客户端类型统一到 TypeBox SSOT，实现端到端类型安全和运行时验证，消除手动维护多层数据结构的复杂性。

## Next Step
Phase 0 原型验证已完成（生成器 + 端到端 + 语义对比测试全通过）。等待用户确认进入 Phase 1（13 张服务端表迁移 + Repository 换 Kysely + JSON 列支持）。

## Current Phase
Phase 0（已完成）→ 待进入 Phase 1

## Phases

### Phase 0: 原型验证（1-2天）
- [x] 选择试点表（auth_users - 简单表，无 JSON 列）
- [x] 实现 codegen 生成器（schema.mts / sql.mts / kysely.mts / run.mts）
  - [x] 处理基础类型（String, Integer, Optional, Boolean, Number）
  - [x] 生成 CREATE TABLE DDL（改用 Kysely Schema Builder，不手写 SQL）
  - [x] 处理索引定义（含列排序）
- [x] 实现 typebox-to-kysely.ts
  - [x] 从 TypeBox schema 生成 Kysely 表接口
- [x] 端到端测试
  - [x] 定义 AuthUserSchema (TypeBox)
  - [x] 生成 SQL migration
  - [x] 生成 Kysely 类型
  - [x] 对比现有 migration 验证正确性（node:sqlite 语义对比）
- [ ] 用 Kysely 类型重写一个简单查询（推迟到 Phase 1 Repository 迁移时验证）
- [x] 记录发现的问题和改进点
- **Status:** 完成（15 测试通过，vp check 全绿）

### Phase 1: 服务端数据层迁移（2-3周）
- [ ] 扩展代码生成器
  - [ ] 支持 JSON 列（JSONColumnType）
  - [ ] 支持外键约束
  - [ ] 支持复合主键
  - [ ] 支持索引（单列、复合、UNIQUE）
- [ ] 迁移服务端 13 张表
  - [ ] auth 模块（auth_users, auth_terminals, auth_sessions）
  - [ ] sync 模块（sync_entities, sync_changes, sync_ops, sync_terminal_cursors）
  - [ ] plugins 模块（server_plugin_registry, server_plugin_installations, server_plugin_jobs, server_plugin_audit）
  - [ ] scripts 模块（server_plugin_scripts, server_plugin_script_runs）
- [ ] 更新 Repository 层
  - [ ] auth.repository.ts - 用 Kysely 替换手写 SQL（~150行）
  - [ ] sync.repository.ts - 用 Kysely 替换手写 SQL（~280行）
  - [ ] plugins.repository.ts - 用 Kysely 替换手写 SQL（~170行）
  - [ ] admin.repository.ts - 用 Kysely 替换手写 SQL（~230行）
- [ ] 验证功能正确性
  - [ ] 运行现有测试（如果有）
  - [ ] 手动测试关键功能
- **Status:** pending

### Phase 2: 客户端数据层迁移（1周）
- [ ] 迁移客户端 9 张表
  - [ ] itemStore（包含 JSON 列 UniItemRaw）
  - [ ] favouriteCard, favouriteItem
  - [ ] history（包含 JSON 列 UniEpRaw）
  - [ ] recentView
  - [ ] subscribe（包含 JSON 列 UniItemAuthor）
  - [ ] plugin（包含 JSON 列 Meta）
  - [ ] config
  - [ ] nativeStore
- [ ] 保留现有 Kysely 查询逻辑
  - [ ] 只替换类型定义，不改查询代码
- [ ] 验证客户端功能
  - [ ] 本地开发环境测试
  - [ ] 检查类型推导正确性
- **Status:** pending

### Phase 3: 运行时验证集成（1周）
- [ ] 服务端验证层
  - [ ] 在 Repository 层添加 TypeBox.Value.Check()
  - [ ] 数据库读取后验证
  - [ ] 数据库写入前验证
  - [ ] 统一错误处理和响应格式
- [ ] 客户端验证层（可选）
  - [ ] 在 Struct 类中集成验证
  - [ ] API 响应验证
- [ ] 性能优化
  - [ ] 验证缓存策略
  - [ ] 关键路径性能测试
- **Status:** pending

### Phase 4: 工具链优化与文档（3-5天）
- [ ] 完善代码生成器
  - [ ] 处理边缘情况
  - [ ] 错误提示优化
  - [ ] 添加注释生成
- [ ] 配置 pre-commit hook
  - [ ] 自动运行代码生成
  - [ ] 检查 schema 一致性
- [ ] 编写开发文档
  - [ ] Schema 定义规范
  - [ ] 新表添加流程
  - [ ] 迁移指南
  - [ ] 故障排查指南
- [ ] 团队培训准备
- **Status:** pending

### Phase 5: 全量测试与验收（1周）
- [ ] 端到端测试
  - [ ] 服务端完整测试套件
  - [ ] 客户端完整测试套件
  - [ ] 集成测试
- [ ] 性能回归测试
  - [ ] 对比迁移前后性能
  - [ ] 验证无性能退化
- [ ] 代码审查
  - [ ] 所有 Repository 重构
  - [ ] 类型定义正确性
- [ ] 记录已知限制和未来改进
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 选择方案 1（TypeBox SSOT）而非 Drizzle | 1. 最小迁移成本（保留 Kysely）<br>2. 已经在用 TypeBox 验证<br>3. 工作量节省 40%（15-22天 vs 27-38天）<br>4. 增量迁移，风险低 |
| SQL 生成使用 Kysely Schema Builder（而非自写字符串拼接） | 1. 不手写 SQL 语法（用户建议）<br>2. Kysely 自带建表 API（addColumn/addPrimaryKeyConstraint/addForeignKeyConstraint/createIndex）<br>3. 类型安全、由库实现 |
| 测试用 node:sqlite 语义对比（而非字节对比） | 1. Kysely 输出紧凑格式与现有美化格式不同<br>2. PRAGMA 结构对比能证明语义等价 |
| 根 package.json 增加 kysely + typebox devDependencies | 生成器在根 script/ 运行，pnpm 严格模式需要显式声明 |
| Rust 代码生成采用手动维护 | 1. Downloader 的 7个 struct 与服务端数据库无关<br>2. 独立 SQLite，无共享 schema<br>3. 手动维护成本低于自动生成工具开发 |
| 第一张试点表选择 auth_users | 1. 结构简单（8个字段）<br>2. 无 JSON 列<br>3. 有现成 TypeBox schema（auth.schemas.ts）<br>4. 验证完整流程的最小代价 |
| 保留客户端现有 Kysely 查询代码 | 1. ~300行查询逻辑已稳定<br>2. 只替换类型定义，不改逻辑<br>3. 降低引入 bug 风险 |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| `TOptional<T>` 是交叉类型，`IsOptional` 与 `IsString` 同时为 true，判断可空性时递归导致 RangeError | 先判断 Optional 决定 `\| null`，再用基础类型判断（不递归） |
| 自写 DDL 字符串拼接（缩进/换行/单列 FK 格式与现有 migration 不一致） | 弃用自写逻辑，改用 Kysely Schema Builder 生成（用户建议，Kysely 自带建表工具） |
| 字节级对比测试不适用（Kysely 输出紧凑格式） | 改用 node:sqlite 执行两套 SQL 后对比 PRAGMA table_info/index_list/index_info/foreign_key_list 语义 |
| sql.test.ts 中 `../set-version.mts` 路径错误（子目录） | 改为 `../../set-version.mts` |
| 测试定义与 migration 实际结构不符（sessions 列名 access_expires_at/refresh_expires_at/rotated_at、terminal_uuid 非可选、索引名、单列/复合 FK） | 逐一对照 0001_auth.sql 修正 |
| Kysely `column('col', 'desc')` 方向参数不生效 | 使用 `'col desc'` 字符串语法（OrderedColumnName） |
| `onDelete` 大写值（'CASCADE'）与 Kysely `OnModifyForeignAction`（小写）不兼容 | DSL 改为小写值，直接透传 |

## Statistics（基于代码分析）

### 数据库表统计
- **服务端（D1）：** 13 张表
  - auth 模块：3 张
  - sync 模块：4 张  
  - plugins 模块：4 张
  - scripts 模块：2 张
- **客户端（Kysely）：** 9 张表
- **Downloader（独立 SQLite）：** 9 张表（不在本次迁移范围）

### JSON 列统计
- **服务端：** 9 个 JSON 列（69% 的表有 JSON 列）
- **客户端：** 4 个 JSON 列（44% 的表有 JSON 列）

### 代码量统计
- SQL migrations: ~118 行
- 服务端 Row Types: ~203 行（3 个文件）
- 服务端 API Schemas: ~400 行（4 个文件）
- 服务端 Repository: ~822 行（4 个文件）
- 客户端 DB Types: ~300 行
- 业务模型类: ~1871 行

**总计需要归一化的代码：约 3700+ 行**

### Rust 代码库情况
- Rust 文件总数：73 个
- Rust struct 总数：119 个
- 数据库相关 struct：仅 Downloader 包的 7 个（独立数据库，不在迁移范围）

## References
- TypeBox 文档: https://github.com/sinclairzx81/typebox
- Kysely 文档: https://kysely.dev/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Elysia TypeBox: https://elysiajs.com/validation/overview.html
