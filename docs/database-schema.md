# TypeBox 数据库 Schema 规范

数据库表定义以 `script/codegen/server.table.mts` 和 `script/codegen/client.table.mts` 为唯一来源。SQL、Kysely 类型和服务端运行时行 schema 都是生成产物，不要直接编辑 `generated/` 目录。

## 定义规范

- 表名、索引名使用小写 snake_case，例如 `auth_users`。
- 每张表必须有非空 `primaryKey`，列名必须存在于 `columns`。
- 可空数据库列使用 `Type.Optional(...)`；生成的数据库行字段仍然存在，运行时值为 `null`。
- JSON 列必须使用 `jsonColumn(typeName, importPath)`，不要直接把 `Type.Object` 或 `Type.Array` 放进表列。
- SQLite 布尔值使用 `Type.Boolean()`，生成器会映射为 `INTEGER` 并添加 `0/1` 检查。
- 外键和索引写在 `meta` 中；复合键按数据库列顺序声明。
- `description` 可写在 TypeBox 列 schema 或 `meta.description` 中，生成器会复制到类型或 SQL 注释。

## 新表流程

1. 在对应的 `.table.mts` 中新增 `defineTable(...)`，同时补充主键、唯一约束、索引和外键。
2. 执行 `vp run codegen`，并检查生成的 SQL、Kysely 类型和运行时 schema。
3. 为表结构和边缘情况添加 `script/test/codegen/` 测试；如是服务端表，还要对照现有 migration 做语义测试。
4. 将生成文件和定义文件一起提交，执行 `vp run codegen:check` 确认没有漂移。
5. Repository 读写边界使用生成的 schema 验证，不要重新声明同一份 row 类型。

## 迁移指南

先修改 TypeBox 定义，再生成产物。需要变更线上数据库时，额外创建按项目迁移编号命名的 SQL migration，并确保旧数据能通过新的运行时 row schema。对于重命名或删除列，先完成兼容读取和数据迁移，再在后续版本清理旧字段。

## 故障排查

- `Invalid table schema`: 检查表名、主键、索引、唯一约束和外键引用的列名。
- `JSON column types must be defined via jsonColumn()`: 将对象或数组列改为 `jsonColumn(...)`，并提供业务类型名。
- `generated file is stale`: 执行 `vp run codegen`，不要手动修改生成文件。
- `DATABASE_SCHEMA_INVALID`: 检查数据库返回的列是否缺失、类型是否为 SQLite 形状（布尔值为 `0/1`，可选列为 `null`），并确认写入使用的是 insert/update 对应类型。

## 常用命令

```sh
vp run codegen
vp run codegen:check
vp check
vp run -r typecheck
vp test run script/test/codegen
```
