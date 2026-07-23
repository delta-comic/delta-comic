# 分支与发布流程

项目使用 Conventional Commits 和 semantic-release 自动计算版本。发布与提交信息中的 `[pub]` 无关，只由推送到哪个长期分支决定。

| 分支 | 用途 | CI 发布 | 版本与渠道 |
| --- | --- | --- | --- |
| `develop` | 日常集成 | 不发布 | 无 |
| `next` | 预览验证 | 自动发布 | `x.y.z-next.N`、GitHub prerelease、npm `next` |
| `main` | 正式发布 | 自动发布 | `x.y.z`、GitHub latest release、npm `latest` |

`fix:` 触发补丁版本，`feat:` 触发次版本，`!` 或 `BREAKING CHANGE` 触发主版本。只有 semantic-release 判定存在可发布提交时，CI 才会构建所有安装包并发布。

release note 与 changelog 使用中文分类，除功能、修复和性能变更外，也会记录重构、文档、构建、CI、测试与其他维护性提交。预览版开头会显示加粗的谨慎更新提示，GitHub Release 标题也会明确标记“预览版”或“正式版”。

发布 npm workspace 时，脚本会从 `packages/*/package.json` 自动发现所有非 `private` 包，校验它们具有统一版本、`build` 脚本及公开发布配置，并按内部依赖顺序逐个构建后递归发布。因此 `@delta-comic/db`、`@delta-comic/model`、`@delta-comic/plugin`、`@delta-comic/ui` 和 `@delta-comic/utils` 会随每次版本一起发布；新增公共 workspace 包也会自动纳入，配置不完整时发布会提前失败。

## 首次建立分支

仓库只有 `main` 时，在干净工作区执行：

```sh
vp run --no-cache branch:develop:dry-run
vp run --no-cache branch:develop
```

该命令从 `origin/main` 创建并推送 `develop`。第一次执行预览晋级时会自动从 `develop` 创建 `next`。

## 日常晋级

先用 dry-run 查看不会修改仓库的操作计划，再执行实际晋级：

```sh
# develop -> next，推送 next 后自动发布预览版
vp run --no-cache release:preview:dry-run
vp run --no-cache release:preview

# next -> main，推送 main 后自动发布正式版
vp run --no-cache release:stable:dry-run
vp run --no-cache release:stable
```

仓库配置已关闭 Vite+ package script 缓存，命令仍显式保留 `--no-cache`，避免未来配置变化或命令行覆盖导致副作用命令只重放旧输出。命令会拒绝脏工作区；本地源分支或目标分支只要含有尚未同步到远端的提交，也会停止。晋级使用普通合并保留分支历史，不会 force push。若合并发生冲突，命令会停留在目标分支，由维护者检查、解决并自行继续推送。

semantic-release 会先完成 tag、npm 包和 GitHub Release，再将版本与 changelog 提交回发布分支。正式版 CI 完成后，将该提交从 `main` 合并回开发线：

```sh
vp run --no-cache branch:develop
```

这一步会同步 `develop`、合并 `origin/main` 并推送 `develop`，避免下一轮预览版继续基于旧的正式版本。

## 手动重跑与保护规则

GitHub Actions 的“构建和发布”工作流可以手动运行，但必须在分支选择器中选择 `main` 或 `next`；选择 `develop` 时发布任务会跳过。重复运行不会强制产生版本，没有新的可发布提交时会安全结束。

### 2.x 撤回后的 3.x 恢复

已撤回的 `2.x` tag 不会重新推送，也不能复用这些版本号。仓库保留的 `semantic-release-2.0.0` git note 指向原始发布提交；在首个 `3.x` 预览版和正式版发布时，维护者需要手动运行“构建和发布”，勾选 `recover_withdrawn_2x`。恢复过程只在 runner 本地临时创建 `2.0.0` 版本下限，并在 semantic-release 推送前删除它，因此远端只会收到真实的 `3.x` tag。

未勾选恢复选项时，工作流会安全结束并提示需要恢复，不会错误地复用 `2.x`。首个 `3.x` tag 建立后，后续发布恢复为普通自动流程。发布前会拒绝任何本地存在但远端不存在的非恢复 tag，避免再次发生全量 tag 推送污染。

建议在 GitHub 中保护三个长期分支：禁止 force push 和删除；`main` 只接受来自 `next` 的晋级，`next` 只接受来自 `develop` 的晋级；必须通过现有检查后才能合并。仓库保护属于 GitHub 管理配置，不由本地脚本修改。
