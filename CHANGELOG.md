**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.15](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.14...3.0.0-next.15) (2026-08-21)


### Bug Fixes

* **plugin:** 支持静态动态远端共存 ([f3dcea7](https://github.com/delta-comic/delta-comic/commit/f3dcea7ebb4f582269f5ec33380388d2b23b11f6))
* **plugin:** 测试模式跳过共享运行时检查 ([ddb8d69](https://github.com/delta-comic/delta-comic/commit/ddb8d69ae7e08d7f97c239ee14e3b03e3414c9a8))


### Features

* **plugin:** 支持动态获取远端列表 ([2ffa92a](https://github.com/delta-comic/delta-comic/commit/2ffa92a932e8052c38d3700f6317a4ab7d7efd79))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.14](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.13...3.0.0-next.14) (2026-08-19)


### Bug Fixes

* **plugin:** 允许删除损坏插件 ([35d64fb](https://github.com/delta-comic/delta-comic/commit/35d64fba5452fd073a25b4e83d0300b00f227e0b))
* **plugin:** 统一 entry.jsPath 为本地开发源入口并修复 dev 插件 500 ([5acfc9a](https://github.com/delta-comic/delta-comic/commit/5acfc9aca48edc9a9249ef975238216e0ddd8ea2))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.13](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.12...3.0.0-next.13) (2026-08-18)


### Bug Fixes

* **app:** 修复了gh-token输入样式 ([9f6f772](https://github.com/delta-comic/delta-comic/commit/9f6f772253f069247ae6632e5163f595beed2aa1))
* **app:** 插件下载确认期间禁用重复确认并加固同类下载弹窗 ([98f3da6](https://github.com/delta-comic/delta-comic/commit/98f3da62ace19905ec90f3211ef0d9c918bd70ea))
* **plugin:** 修复插件 CSS 入口解析 ([872fb38](https://github.com/delta-comic/delta-comic/commit/872fb384cd10fecd3e8e773dcf3da2bc8de2955f))
* **plugin:** 预启动阶段注册插件 i18n 并补齐 core 配置文案 ([f3887df](https://github.com/delta-comic/delta-comic/commit/f3887df1388232db1a937ae87b75ecac569ae6fe))
* **server-admin:** 插件动作进行中禁用重复确认并锁定确认弹窗 ([2147442](https://github.com/delta-comic/delta-comic/commit/214744252233bf870365c2031598f1478850c2e9))


### Features

* **app:** 启动配置支持 GitHub Token ([e9145f2](https://github.com/delta-comic/delta-comic/commit/e9145f2aecb11a26b6d405fa949765284efbc69b))
* **plugin:** 实现持久化开发服务器协议 ([0736f4f](https://github.com/delta-comic/delta-comic/commit/0736f4f0479b10e8946009b2e9f8858ceac72d51))
* **plugin:** 开发服务器接入原生 Vite HMR ([6ad37d6](https://github.com/delta-comic/delta-comic/commit/6ad37d6f55c6b7af795a3e1b17f656626357223d))
* **plugin:** 接入自定义 Vite 开发协议并移除 vite-plugin-monkey ([d000970](https://github.com/delta-comic/delta-comic/commit/d00097097dc30cccfe27d7e7f565b6def19a8943))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.12](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.11...3.0.0-next.12) (2026-08-16)


### Bug Fixes

* **app:** 修复类型错误 ([a33232f](https://github.com/delta-comic/delta-comic/commit/a33232f626e145c53a9b305fc9cc47d02884b83f))
* **db,ui:** 修复泛型类型和 JSONColumnType Selectable 映射 ([fc39223](https://github.com/delta-comic/delta-comic/commit/fc392230c746bf979b11719927ec14c2f12253fc))


### Features

* **codegen:** 完成 Phase 4 工具链优化 ([b4169fe](https://github.com/delta-comic/delta-comic/commit/b4169fea02f573670b492864e237460ac7f66272))
* **codegen:** 实现 TypeBox 表定义 DSL 与 Kysely Schema Builder 驱动的 SQL 生成器 ([c83892b](https://github.com/delta-comic/delta-comic/commit/c83892b35efdb9735b4b522c331a26e40b60ae69))
* **codegen:** 支持 DEFAULT/CHECK 约束生成并导出 Kysely Selectable 系列类型 ([f43aace](https://github.com/delta-comic/delta-comic/commit/f43aacebc27807f3a1e2836e99bf937b9bd2f612))
* **codegen:** 支持服务端同步表结构 ([5ebb9cb](https://github.com/delta-comic/delta-comic/commit/5ebb9cbfa4d5231dbb54883379878bbe3b91e761))
* **db:** 接入客户端数据库运行时校验 ([f0ea21e](https://github.com/delta-comic/delta-comic/commit/f0ea21efb04a2e3cfea4664f8412ae371986b154))
* **server:** 集成 TypeBox 运行时数据验证 ([9ecc0c4](https://github.com/delta-comic/delta-comic/commit/9ecc0c4d5e6b1f47f49e599ce0129c825e21b034))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.11](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.10...3.0.0-next.11) (2026-08-15)


### Bug Fixes

* **app:** 修复插件安装确认弹窗 ([64d1736](https://github.com/delta-comic/delta-comic/commit/64d173696582fd71c6f9edddf8f2610c49455110))
* **app:** 修复插件安装确认弹窗 ([beb5bff](https://github.com/delta-comic/delta-comic/commit/beb5bff52620d4bcf654d353754cb863298e2c1e))
* **app:** 修复自动大写禁用逻辑 ([184341a](https://github.com/delta-comic/delta-comic/commit/184341a23b15765fbcea2d833b914061eb591f25))
* **app:** 修复自动大写禁用逻辑 ([a1f91c7](https://github.com/delta-comic/delta-comic/commit/a1f91c7df02e91632cebfba76313ac4bdbffb52b))
* **app:** 允许原生端写入剪贴板 ([ef9a84a](https://github.com/delta-comic/delta-comic/commit/ef9a84a8f85fc58f57759e27eeae7fea36722535))
* **app:** 允许原生端写入剪贴板 ([09826cb](https://github.com/delta-comic/delta-comic/commit/09826cb40100ffcd26831bc707fa70eae117911d))
* **app:** 展示未知总量下载状态 ([9827c06](https://github.com/delta-comic/delta-comic/commit/9827c0616d23c4a126d8d1e4bb192e39271dcb9f))
* **app:** 展示未知总量下载状态 ([a6a6ef3](https://github.com/delta-comic/delta-comic/commit/a6a6ef3f375829bc87370f7687acb2271dfd1b78))
* **app:** 恢复插件安装进度提示 ([3643d80](https://github.com/delta-comic/delta-comic/commit/3643d806971a486f0c1f2e4979a5149c2f3fe364))
* **app:** 恢复插件安装进度提示 ([fe82500](https://github.com/delta-comic/delta-comic/commit/fe82500365b6ecea49d12d07697fc1fe5b707299))
* **app:** 恢复插件更新反馈 ([9ad8764](https://github.com/delta-comic/delta-comic/commit/9ad8764b4f7a005abb18979560907748eed66a4d))
* **app:** 恢复插件更新反馈 ([fb0923c](https://github.com/delta-comic/delta-comic/commit/fb0923c86611a1cf57bfccae6d3b76a22ce86b16))
* **app:** 按阶段创建插件安装进度 ([a658897](https://github.com/delta-comic/delta-comic/commit/a658897fb5069dfec994e4f68b879d3ef742c7af))
* **app:** 按阶段创建插件安装进度 ([49c42a2](https://github.com/delta-comic/delta-comic/commit/49c42a26e323ce3e4df9738ee2be0c2707715758))
* **app:** 显示插件安装确认按钮 ([48157bb](https://github.com/delta-comic/delta-comic/commit/48157bbef6435eee9b3d544aa57eb7fcc9156f6a))
* **app:** 显示插件安装确认按钮 ([b11b57f](https://github.com/delta-comic/delta-comic/commit/b11b57f2d6f0fa46da903b8c7c17978fc72716b8))
* **app:** 禁用输入框自动大写 ([7bf3a01](https://github.com/delta-comic/delta-comic/commit/7bf3a01e6f129cc2b86384d71319d10e17bfec78))
* **app:** 禁用输入框自动大写 ([24254a0](https://github.com/delta-comic/delta-comic/commit/24254a0c3cbe2f5886d9da5875225e938f2429ce))
* **app:** 给enable打补丁，实质问题未解决 ([b895a74](https://github.com/delta-comic/delta-comic/commit/b895a749d0a76ec3af1418fd9e9995d84c4a90ac))
* **app:** 给enable打补丁，实质问题未解决 ([cf2f6ab](https://github.com/delta-comic/delta-comic/commit/cf2f6ab114388230e53bcbcf111e4f04bc0f0ddc))
* **app:** 鉴权弹窗解析插件文本协议键与普通 i18n 键 ([fbf362e](https://github.com/delta-comic/delta-comic/commit/fbf362e03035b809abf8300afbf27891b330c3c5))
* **app:** 鉴权弹窗解析插件文本协议键与普通 i18n 键 ([2ea9318](https://github.com/delta-comic/delta-comic/commit/2ea9318e6d26557075cb30666426c730e62e8eb9))
* **ci:** release 各平台构建跳过已下载的工作区产物 ([99ec2ed](https://github.com/delta-comic/delta-comic/commit/99ec2ed43713ac7f0376121ef058888cfac06466))
* **downloader:** 实时发送 HTTP 下载进度 ([12e7c9c](https://github.com/delta-comic/delta-comic/commit/12e7c9c8fec7671db5063851268846741eb59ece))
* **downloader:** 实时发送 HTTP 下载进度 ([75a181d](https://github.com/delta-comic/delta-comic/commit/75a181d26f88f86e42ec638f9cbf82ec607b5454))
* **i18n:** 移除未实现的语言选项 ([23c8dc9](https://github.com/delta-comic/delta-comic/commit/23c8dc911779d4447089562924991a61d4621aec))
* **i18n:** 移除未实现的语言选项 ([c04411b](https://github.com/delta-comic/delta-comic/commit/c04411b25e8025c485ac1cca5bb17585284523b3))
* **plugin:** i18n 注册表合成不再突变宿主与插件消息 ([fb574b3](https://github.com/delta-comic/delta-comic/commit/fb574b3c5bc9dd022aa7792209268acc11eabac5))
* **plugin:** i18n 注册表合成不再突变宿主与插件消息 ([cfe5e16](https://github.com/delta-comic/delta-comic/commit/cfe5e166a071f6d8fe611f89835f2ae47f909fd9))
* **plugin:** 优先使用内置插件候选 ([5121387](https://github.com/delta-comic/delta-comic/commit/5121387e1b5872ea4f70c47bb7c05150e63d1167))
* **plugin:** 优先使用内置插件候选 ([58adeae](https://github.com/delta-comic/delta-comic/commit/58adeae4012775b391197fc34c8d4e20701b1d00))
* **plugin:** 修正插件启用状态并规范化布尔边界 ([8ba801a](https://github.com/delta-comic/delta-comic/commit/8ba801a9ff20cc8965d4e09b035e81d27152b329))
* **plugin:** 修正插件启用状态并规范化布尔边界 ([5830c9c](https://github.com/delta-comic/delta-comic/commit/5830c9cca2f1c13a40950aaf491b4305fcafcc9f))
* **plugin:** 支持接收插件预览版更新 ([0886fe3](https://github.com/delta-comic/delta-comic/commit/0886fe3a361ff91bbbe47eaf69ac6bdb2a28d22b))
* **plugin:** 支持接收插件预览版更新 ([89c035a](https://github.com/delta-comic/delta-comic/commit/89c035a775a2d9bd852baaed5a8b0c77676b1852))
* **plugin:** 自动下载插件依赖 ([a1f7d5a](https://github.com/delta-comic/delta-comic/commit/a1f7d5a6bc36c5cb7e471a9e061e05f25c62a17f))
* **plugin:** 自动下载插件依赖 ([4479561](https://github.com/delta-comic/delta-comic/commit/4479561434760a9a294eda02c18ed3cbfcb32478))
* **plugin:** 避免依赖异常阻塞应用启动 ([7e5f60d](https://github.com/delta-comic/delta-comic/commit/7e5f60da579c80dbafaf31dc821f7fc6cbcb7739))
* **plugin:** 避免依赖异常阻塞应用启动 ([224b80f](https://github.com/delta-comic/delta-comic/commit/224b80f21e50c8962a29bc22b561dfc320adcc41))
* **splash:** 开屏页没有vue实例问题 ([cb6d0c1](https://github.com/delta-comic/delta-comic/commit/cb6d0c1135f9418bf4da609e78f2e6a13765fb74))
* **splash:** 开屏页没有vue实例问题 ([6b0856a](https://github.com/delta-comic/delta-comic/commit/6b0856aa17b3f8c11151bc3ac4f0752143d7d712))
* **style:** 修复ai所写的过度设计 ([51b222d](https://github.com/delta-comic/delta-comic/commit/51b222def8fa70d1f28221f005d5651941df287d))
* **ui:** 修复下载消息结算与进度边界 ([6507b7a](https://github.com/delta-comic/delta-comic/commit/6507b7a295df7676f61fab1aab724e9d0bdea2bc))
* **ui:** 修复下载消息结算与进度边界 ([60830d4](https://github.com/delta-comic/delta-comic/commit/60830d40e881cb67be90f815ee2366fab669fa8e))


### Features

* **downloader:** 更新 Android 下载通知进度 ([e246fd3](https://github.com/delta-comic/delta-comic/commit/e246fd3cd062da4e25aa0e9b233ce42925d23269))
* **downloader:** 更新 Android 下载通知进度 ([7c9ba05](https://github.com/delta-comic/delta-comic/commit/7c9ba0538f935b6963491d4f27c07e3968f999d9))
* **logger:** 为终端日志等级添加颜色 ([8d1cf55](https://github.com/delta-comic/delta-comic/commit/8d1cf555534890521e1f9319c21e00f3bf489d57))
* **logger:** 为终端日志等级添加颜色 ([567f4a4](https://github.com/delta-comic/delta-comic/commit/567f4a459cf995b166806e7bc9ccc45db29c555a))
* **plugin:** 安装更新即用与插件热重载 ([e7ca2d1](https://github.com/delta-comic/delta-comic/commit/e7ca2d17d78ffad6c28b527c74b2ac6b09fd8e6a))
* **plugin:** 安装更新即用与插件热重载 ([c6f7bbd](https://github.com/delta-comic/delta-comic/commit/c6f7bbd024a4705a705e63e643be99ed20ba54c1))
* **plugin:** 报告插件下载字节进度 ([f34a645](https://github.com/delta-comic/delta-comic/commit/f34a645972e9acdbab5af93cc8f63e79739441fa))
* **plugin:** 报告插件下载字节进度 ([a44c043](https://github.com/delta-comic/delta-comic/commit/a44c0439647d22ac6b6ce70c38efd3ba5bbd7375))
* **plugin:** 支持动态启用与停用插件 ([6dcbd50](https://github.com/delta-comic/delta-comic/commit/6dcbd5043004f5b49d80ab406dd77fa939761531))
* **plugin:** 支持动态启用与停用插件 ([2e9d62e](https://github.com/delta-comic/delta-comic/commit/2e9d62ec38fdfa39ac7552fed8d829c396fdee2a))
* **plugin:** 支持多文件插件协议 ([e8b609d](https://github.com/delta-comic/delta-comic/commit/e8b609d314c4fc9844afe473d9fe8759653b4194))
* **plugin:** 支持多文件插件协议 ([21e739a](https://github.com/delta-comic/delta-comic/commit/21e739a59e5a4ae00bfd145290c79d76a4d0be25))


### Performance Improvements

* **build:** 优化 Rust nightly 编译配置 ([e2a7651](https://github.com/delta-comic/delta-comic/commit/e2a7651b6ec319a6ff1e0930a596d93169cb8dd5))
* **build:** 优化 Rust nightly 编译配置 ([8612442](https://github.com/delta-comic/delta-comic/commit/8612442d6ffd1d829b17f32b45db79c09eeee5ad))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.10](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.9...3.0.0-next.10) (2026-08-10)


### Features

* **plugin:** 让expose类型安全化 ([db8962f](https://github.com/delta-comic/delta-comic/commit/db8962f6fa0ad024eafff3be9bf8646352af681c))


### Reverts

* **plugin:** 移除safe模式 ([5ccf3d8](https://github.com/delta-comic/delta-comic/commit/5ccf3d83396d7e4f8f5ee597ed2f10c37f0667c3))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.9](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.8...3.0.0-next.9) (2026-08-02)


### Bug Fixes

* **plugin:** 修复了auth调用modal的问题 ([1d28d4f](https://github.com/delta-comic/delta-comic/commit/1d28d4f77bf29132e26c73957546c5cad8185d95))


### Features

* **plugin:** 完成了核心插件的定义 ([52512fb](https://github.com/delta-comic/delta-comic/commit/52512fbd51de1724ce105b9ccc59f1905bd34ee1))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.8](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.7...3.0.0-next.8) (2026-07-31)


### Bug Fixes

* **ui:** 修复列表虚拟可见区域计算 ([3a0ebae](https://github.com/delta-comic/delta-comic/commit/3a0ebaeafa7a0dce1efcf53d0559473107822456))


### Features

* **app:** 为启动页添加背景 ([a2c9196](https://github.com/delta-comic/delta-comic/commit/a2c9196f830a5bd1509d60219668cc83732b7529))
* **app:** 优化了配置显示 ([c3a1077](https://github.com/delta-comic/delta-comic/commit/c3a1077f818ec053188486778238a9644eb79f96))
* **ui:** 完善瀑布流展示页数据操作 ([bef5ab0](https://github.com/delta-comic/delta-comic/commit/bef5ab05ebee743083ba41b4f85face899677cb3))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.7](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.6...3.0.0-next.7) (2026-07-29)


### Bug Fixes

* **plugin:** 修复了config没有泛型的问题 ([e2f2143](https://github.com/delta-comic/delta-comic/commit/e2f214329d1865c139325c6a0b15de277cda4302))


### Features

* **app:** 适配策略优化 ([9638049](https://github.com/delta-comic/delta-comic/commit/9638049e6feae05fc7363dd8e438b8148150c35f))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.6](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.5...3.0.0-next.6) (2026-07-27)


### Features

* **ui:** 提取共享 Tailwind 插件 ([d2cf313](https://github.com/delta-comic/delta-comic/commit/d2cf313b89590d1fecc8d1b6c5b307e9a1f35b1c))
* **ui:** 重新设计样式系统 ([1782b00](https://github.com/delta-comic/delta-comic/commit/1782b00adb2fa9dbc83a66c6998138eaefe9bb28))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.5](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.4...3.0.0-next.5) (2026-07-27)


### Bug Fixes

* **release:** 触发 Uni 模型 API 预览发布 ([954327c](https://github.com/delta-comic/delta-comic/commit/954327c5d76bda6a84be348d155cd032a0e72176))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.4](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.3...3.0.0-next.4) (2026-07-26)


### Bug Fixes

* **release:** 使用 OIDC 发布 npm 包 ([3403f5c](https://github.com/delta-comic/delta-comic/commit/3403f5cd466ba12b347781663cf6094cf5198db6))

<!-- cspell:ignore avator cmdline premote wiew tabbar -->

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.2](https://github.com/delta-comic/delta-comic/compare/3.0.0-next.1...3.0.0-next.2) (2026-07-24)


### Bug Fixes

* **app:** 修复移动端插件初始化失败 ([1144c0c](https://github.com/delta-comic/delta-comic/commit/1144c0cf548c0bcdc03ec247240a8df1e5eac1ff))
* **downloader:** 修正 Android JNI 导出包名 ([1b2a536](https://github.com/delta-comic/delta-comic/commit/1b2a536524a37097ca57ad4e071e6ddaccc5f8cd))

**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请酌情更新。**

# [3.0.0-next.1](https://github.com/delta-comic/delta-comic/compare/1.3.0...3.0.0-next.1) (2026-07-23)


* feat(release)!: 切换至 semantic-release 发布链路 ([a4b6d1d](https://github.com/delta-comic/delta-comic/commit/a4b6d1d50b619c3ad40c16ffc81999f1a5818551))


### Bug Fixes

* **app:** remove final legacy component reference ([a76d96d](https://github.com/delta-comic/delta-comic/commit/a76d96d84b5d558d3061dc4aee5469db1554ea5c))
* **app:** 完善收藏夹路由与全屏搜索 ([d2cabd0](https://github.com/delta-comic/delta-comic/commit/d2cabd033fabe637416ede28104e78379777649e))
* **app:** 恢复原生开发热更新 ([f03d563](https://github.com/delta-comic/delta-comic/commit/f03d5630a65d85a07618f2f3ece19c5b227e0cbd))
* **build:** 兼容 Rust 严格 Clippy 检查 ([760f18d](https://github.com/delta-comic/delta-comic/commit/760f18dea6407d180a20b409ed4a12699a891198))
* **ci:** lockfile no sync ([ab85f6d](https://github.com/delta-comic/delta-comic/commit/ab85f6d003cef7948765f03cee9f96bd3caa6482))
* **ci:** 尝试修复ci检查问题 ([83e4c26](https://github.com/delta-comic/delta-comic/commit/83e4c26df99027fbb1a679ce1c99a8ed685bdd39))
* colada实例随调用初始化 ([8fa7928](https://github.com/delta-comic/delta-comic/commit/8fa79285fd60451c40381948d640b23343f6a722))
* core的类型问题 ([55cec3d](https://github.com/delta-comic/delta-comic/commit/55cec3d903bf0f14f1f6d6c953212fb0daf92758))
* **db:** 避免配置水合触发重复写入 ([8977535](https://github.com/delta-comic/delta-comic/commit/8977535bda71daefb0a9f2be4a5ed26c63a1afbe))
* **docs:** 修复文档图标 ([dde680d](https://github.com/delta-comic/delta-comic/commit/dde680dcc0c46acbce14fb81b03589310c5de939))
* **downloader:** 限定凭据服务常量的平台范围 ([21f4be7](https://github.com/delta-comic/delta-comic/commit/21f4be7877b7ce2eabed3c6a516819facc6cce45))
* image重试逻辑 ([3832e1a](https://github.com/delta-comic/delta-comic/commit/3832e1a4e4def829216c6dec95da91a1e005533c))
* lint ([447e648](https://github.com/delta-comic/delta-comic/commit/447e64838017c5f5ca6bd147a41e8816fd903278))
* **plugin:** 校验下载运行时插件代次 ([7490668](https://github.com/delta-comic/delta-comic/commit/7490668f41e55765ca783fadb64cdc6a8b45c201))
* **plugin:** 阻止共享运行时子路径绕过外部化 ([2f6bcf3](https://github.com/delta-comic/delta-comic/commit/2f6bcf39ea29f7410a63baf69927ed569110bbe8))
* **release:** 使用工作流令牌发布软件包 ([5f41517](https://github.com/delta-comic/delta-comic/commit/5f415171c5228aceedb9cfe1124f87eaf7d14727))
* **release:** 修复撤回版本的发布恢复流程 ([d5ca405](https://github.com/delta-comic/delta-comic/commit/d5ca405e55a7cd0c35962b15414eeec6cdff86a8))
* remove NPM_TOKEN env var from .npmrc to avoid local warnings ([4b891ec](https://github.com/delta-comic/delta-comic/commit/4b891ec13767cbb10ca6447d111f3f6080ac3623))
* **settings:** 补充日志阅读器关闭操作 ([6735f49](https://github.com/delta-comic/delta-comic/commit/6735f49923b3207c8622c2c72c4a0808f9762fbd))
* tw-merge类型意外泄漏 ([2edfb5e](https://github.com/delta-comic/delta-comic/commit/2edfb5e747ce6867b4b1c1e9a935dc13e737945f))
* type ([7a20220](https://github.com/delta-comic/delta-comic/commit/7a202201e5e9f6b745bf33a6a9a21fc7c2594ba6))
* **ui:** 修复组件展示所需的属性契约 ([8d18255](https://github.com/delta-comic/delta-comic/commit/8d18255e1b664f2c2510e1ea093d69c3b40ee8fe))
* **ui:** 修复返回拦截问题 ([8d4c2ab](https://github.com/delta-comic/delta-comic/commit/8d4c2ab2d911362b1eb418f77cff6d9888896121))
* **ui:** 对齐桌面文档布局 ([b31f689](https://github.com/delta-comic/delta-comic/commit/b31f689e0136c6aec67becf09818bbf59922ab1f))
* ui库类型错误 ([7ff0f01](https://github.com/delta-comic/delta-comic/commit/7ff0f01bd6b50310a2a791a8eced226634067f71))
* ui构建失败 ([cb3f669](https://github.com/delta-comic/delta-comic/commit/cb3f66917f8f9bc18f252955b671aca85645355d))
* ui构建类型错误问题 ([93cf4a0](https://github.com/delta-comic/delta-comic/commit/93cf4a0c5f147322827f458bb7793b80f4a38079))
* update不接受预版本更新 [pub][only-lib] ([d225f6b](https://github.com/delta-comic/delta-comic/commit/d225f6b19d4fdf2359d921be83622cc8fea8f70f))
* **utils:** 修复了由pinia导致的temp卡死问题 ([#36](https://github.com/delta-comic/delta-comic/issues/36)) ([1cdbbcc](https://github.com/delta-comic/delta-comic/commit/1cdbbcca9948503d01f968cc26af8bd9721a8daa))
* 修复list表现效果 ([49b5c08](https://github.com/delta-comic/delta-comic/commit/49b5c083b3391574da3f0e1033747b8dc0ba8140))
* 修复peer依赖混乱 ([5ebfe49](https://github.com/delta-comic/delta-comic/commit/5ebfe49326f01726e40395b22eda9caf73a05096))
* 修复了循环依赖(plugin,db,ui) ([1b828f2](https://github.com/delta-comic/delta-comic/commit/1b828f2ca78c989e874bf7fd4a981db8bdf69b8e))
* 修复了暗色模式问题 ([371f3c5](https://github.com/delta-comic/delta-comic/commit/371f3c5b562523b4125dd540c3ba308b9bd3781a))
* 修复了样式检查 ([fcff6ed](https://github.com/delta-comic/delta-comic/commit/fcff6ed11496b07129dd3c69b38fb5344f00146f))
* 修复了网络错误 ([3725028](https://github.com/delta-comic/delta-comic/commit/3725028ef39597165b0d31cb244ae8b107e2137e))
* 修复数据库初始同步失效问题 ([f3545ad](https://github.com/delta-comic/delta-comic/commit/f3545ad8710297c710432f91b3cfcbcb0a97cbf5))
* 构建使用官方 [pub] ([cf0d1ab](https://github.com/delta-comic/delta-comic/commit/cf0d1abc1db9fe4b3f30217444eec6a0d4b632ce))
* 构建流程sdk无法找到 [pub] ([ac33a33](https://github.com/delta-comic/delta-comic/commit/ac33a330c97f39fd49a0640fda68c54531b607e5))
* 路由类型修正 ([da05971](https://github.com/delta-comic/delta-comic/commit/da059719c960fb5a9dc9be81bdd571319b435437))


### Features

* add GitHub Packages publish workflow and CLI commands ([f787c9f](https://github.com/delta-comic/delta-comic/commit/f787c9fe79cefef5ad24d8c92303cb0963c646b0))
* **app:** add web runtime and responsive plugin lifecycle ([ad7f845](https://github.com/delta-comic/delta-comic/commit/ad7f8459d2ee2cd7d01808e76383d60c872c080d))
* **app:** remember plugin startup and add i18n ([7125627](https://github.com/delta-comic/delta-comic/commit/71256272f4840d17f9253aee609252d345e50cfc))
* **app:** 使用预构建 UMD 共享宿主运行时 ([2c0a2ce](https://github.com/delta-comic/delta-comic/commit/2c0a2ce07e7f76540420c657d915f856a6c31f24))
* **app:** 修复收藏夹路由并添加列表视图 ([85fb269](https://github.com/delta-comic/delta-comic/commit/85fb269211200955e549dfa0af949c78d78076b6))
* **app:** 实现分页插件市场 ([ef7d507](https://github.com/delta-comic/delta-comic/commit/ef7d5076d4babcda551d7f671a328775a043f4a9))
* **app:** 实现响应式下载管理面板 ([8a3fd46](https://github.com/delta-comic/delta-comic/commit/8a3fd462ed1fb69f586228c5198374696ba770ff))
* **app:** 接入下载器原生生命周期 ([ef2e832](https://github.com/delta-comic/delta-comic/commit/ef2e832ba20e789eb7f175b861ab724894882f12))
* **app:** 添加等待插件预启动的开屏界面 ([0f41b12](https://github.com/delta-comic/delta-comic/commit/0f41b12433533cbf1a839950c3d7e3a4185eb25b))
* **app:** 重构多入口开屏与原生启动流程 ([de4cd8a](https://github.com/delta-comic/delta-comic/commit/de4cd8abcc74a83243faba511dc2a02e5324d399))
* **app:** 重现主界面底部导航 ([7f7672f](https://github.com/delta-comic/delta-comic/commit/7f7672ff9de97f387d823ff22c02f0de83cde96e))
* **db,app:** 使用`@pinia/colada`重构数据库的响应式系统 ([f6fd159](https://github.com/delta-comic/delta-comic/commit/f6fd159213953b292568d1d1c33cc3f951098ccb))
* **db:** persist native and config stores in sqlite ([#40](https://github.com/delta-comic/delta-comic/issues/40)) ([e49eda6](https://github.com/delta-comic/delta-comic/commit/e49eda67bdc7c16d5172a7668667d066f6ea61c7))
* **downloader:** 将 BT peer 纳入全局连接预算 ([888a1ff](https://github.com/delta-comic/delta-comic/commit/888a1ff0b97202d0419dc9732f76bb16c1579141))
* **downloader:** 搭建专业下载器插件与持久化内核 ([3c1a778](https://github.com/delta-comic/delta-comic/commit/3c1a778f3090fb2b5ad8b20c4eaef6f66b8e1cd5))
* **downloader:** 支持 SAF 可寻址文件直写 ([3b09cf4](https://github.com/delta-comic/delta-comic/commit/3b09cf42cc7a7bc12b06c5566f0fe7e3b2e0c4d4))
* **i18n:** 完成应用界面文案国际化 ([994693f](https://github.com/delta-comic/delta-comic/commit/994693f5477287e3880ec91f560bbbbc7d2c8e88))
* **i18n:** 新增台湾繁体中文支持 ([7476e0b](https://github.com/delta-comic/delta-comic/commit/7476e0bb7910dd5764121278fa5b5e9e37d172c9))
* **logger:** 建立统一异步日志基础设施 ([de4cbb3](https://github.com/delta-comic/delta-comic/commit/de4cbb3bd0873f29177144d37f7bb9a966f23dce))
* **logger:** 接入全仓关键运行日志 ([86235c3](https://github.com/delta-comic/delta-comic/commit/86235c3929d8630571268ce01134da33f207cb0a))
* **plugin:** add bundled plugin runtime ([6c33ad0](https://github.com/delta-comic/delta-comic/commit/6c33ad03f3fe2d7bfc6dcc5ac5215787582ca8c8))
* **plugin:** select compatible GitHub release ([c071d70](https://github.com/delta-comic/delta-comic/commit/c071d709cf0629ae3fb50d6322b8e654f4121726))
* **plugin:** 使用原生下载器获取插件资源 ([1d352c6](https://github.com/delta-comic/delta-comic/commit/1d352c6755aa488eb719c5380d9f2bbdf658691c))
* **plugin:** 完成响应式数据库重构 ([1aa519c](https://github.com/delta-comic/delta-comic/commit/1aa519c210dc61d03c6ccb9fc3c541294dc44bb8))
* **plugin:** 扩展内容下载协议 ([bbac8c6](https://github.com/delta-comic/delta-comic/commit/bbac8c6211320a56376ab4be3c2686bbaa0cd2e4))
* plugin插件内容无下载解析 ([739ffde](https://github.com/delta-comic/delta-comic/commit/739ffde095364f17b923ac2614050deb47e640c8))
* **plugin:** 支持插件图标展示 ([44726a7](https://github.com/delta-comic/delta-comic/commit/44726a715ebe948f577e73e6c15ce60b4475c50c))
* **release:** 完善工作区发布与中文说明 ([abdf558](https://github.com/delta-comic/delta-comic/commit/abdf55826c3a86d1b460174c2bf6de36132df5b7))
* **search:** 添加独立搜索页和热搜插件接口 ([37a32c3](https://github.com/delta-comic/delta-comic/commit/37a32c34df20f93539304584818e800411c9a1e6))
* **server-admin:** manage scheduled plugin scripts ([938f617](https://github.com/delta-comic/delta-comic/commit/938f6176710a0915cd3e3af38e6fcdf941a12a64))
* **server:** add cloudflare pages admin panel ([#41](https://github.com/delta-comic/delta-comic/issues/41)) ([cdbfec9](https://github.com/delta-comic/delta-comic/commit/cdbfec99b85abe70ece5a0428341c1158172bd3d))
* **server:** add isolated scheduled plugin scripts ([26c335a](https://github.com/delta-comic/delta-comic/commit/26c335a7d0678fa78971f8b7373d91e64bcd9610))
* **server:** grant scripts network and database access ([85d1aab](https://github.com/delta-comic/delta-comic/commit/85d1aab972d4789a0c725063f305b27391811751))
* **settings:** 增加原生日志阅读与导出 ([cff9963](https://github.com/delta-comic/delta-comic/commit/cff9963ed5ada4c417a9bea9e4ab5283f3c42130))
* **ui:** 优化了导航栏的行为 ([12af4bd](https://github.com/delta-comic/delta-comic/commit/12af4bd83d2164ecaa66291c49ad651b3b7365c3))
* **ui:** 补齐全部组件展示条目 ([f32a9b0](https://github.com/delta-comic/delta-comic/commit/f32a9b0c2a8ecfbf8a7ff50e474c3fe7283d8f25))
* **ui:** 重构组件展示页面 ([dd2cd2c](https://github.com/delta-comic/delta-comic/commit/dd2cd2c240c78a87a73f7a01a175e4813d038b32))
* webview鉴权 ([59c16bf](https://github.com/delta-comic/delta-comic/commit/59c16bf0cd99e156906d07f33ca30ae4f854e154))
* 为list添加stream模式 ([82ab5eb](https://github.com/delta-comic/delta-comic/commit/82ab5eb35bfcafc52b83a6853ff1e358eadd5e4e))
* 优化fetch返回 [pub] ([3661464](https://github.com/delta-comic/delta-comic/commit/36614649c757b35b0d423a69be0a9fde09a108fe))
* 优化了server代码架构 ([6189783](https://github.com/delta-comic/delta-comic/commit/6189783de9e46af2c237f2faa657ab84e098b8d4))
* 实现客户端server ([81ef9f8](https://github.com/delta-comic/delta-comic/commit/81ef9f88ebd3affa1fee4d55dc7a03626a98fac8))
* 更好的实现popup ([1999e0a](https://github.com/delta-comic/delta-comic/commit/1999e0a3128e3442cad3ccbe6f4950bafa952151))
* 调优model [pub][only-lib] ([6591832](https://github.com/delta-comic/delta-comic/commit/6591832109eec33a5eee6ed80d48b1f72eb46cb8))
* 重返启动dev ([85a86f2](https://github.com/delta-comic/delta-comic/commit/85a86f24f53cbab77e6e5e5b8b3b22e8ceec3a01))


### Performance Improvements

* 基本完成了服务端插件系统 ([ede7f76](https://github.com/delta-comic/delta-comic/commit/ede7f76cfb15bd42d5eb1a630a47f79f21fffffb))


### pref

* 新版本发布触发 ([2b0e051](https://github.com/delta-comic/delta-comic/commit/2b0e0517c911311a783e8546436bc860ddfbcc3d))


### BREAKING CHANGES

* 发布版本改由 Conventional Commits 自动推断。
* 插件底层大改，旧插件要完全重构
* 插件底层大改，旧插件要完全重构

# delta-comic

## [2.0.0](https://github.com/delta-comic/delta-comic/compare/1.3.0...2.0.0) (2026-04-14)


### Bug Fixes

* colada实例随调用初始化 ([8fa7928](https://github.com/delta-comic/delta-comic/commit/8fa79285fd60451c40381948d640b23343f6a722))
* **docs:** 修复文档图标 ([dde680d](https://github.com/delta-comic/delta-comic/commit/dde680dcc0c46acbce14fb81b03589310c5de939))
* tw-merge类型意外泄漏 ([2edfb5e](https://github.com/delta-comic/delta-comic/commit/2edfb5e747ce6867b4b1c1e9a935dc13e737945f))
* **ui:** 修复返回拦截问题 ([8d4c2ab](https://github.com/delta-comic/delta-comic/commit/8d4c2ab2d911362b1eb418f77cff6d9888896121))
* 修复了循环依赖(plugin,db,ui) ([1b828f2](https://github.com/delta-comic/delta-comic/commit/1b828f2ca78c989e874bf7fd4a981db8bdf69b8e))
* 修复了样式检查 ([fcff6ed](https://github.com/delta-comic/delta-comic/commit/fcff6ed11496b07129dd3c69b38fb5344f00146f))
* 修复数据库初始同步失效问题 ([f3545ad](https://github.com/delta-comic/delta-comic/commit/f3545ad8710297c710432f91b3cfcbcb0a97cbf5))
* 构建使用官方 [pub] ([cf0d1ab](https://github.com/delta-comic/delta-comic/commit/cf0d1abc1db9fe4b3f30217444eec6a0d4b632ce))
* 构建流程sdk无法找到 [pub] ([ac33a33](https://github.com/delta-comic/delta-comic/commit/ac33a330c97f39fd49a0640fda68c54531b607e5))


### Features

* **db,app:** 使用`@pinia/colada`重构数据库的响应式系统 ([f6fd159](https://github.com/delta-comic/delta-comic/commit/f6fd159213953b292568d1d1c33cc3f951098ccb))
* **plugin:** 完成响应式数据库重构 ([1aa519c](https://github.com/delta-comic/delta-comic/commit/1aa519c210dc61d03c6ccb9fc3c541294dc44bb8))
* **ui:** 优化了导航栏的行为 ([12af4bd](https://github.com/delta-comic/delta-comic/commit/12af4bd83d2164ecaa66291c49ad651b3b7365c3))
* 为list添加stream模式 ([82ab5eb](https://github.com/delta-comic/delta-comic/commit/82ab5eb35bfcafc52b83a6853ff1e358eadd5e4e))
* 优化fetch返回 [pub] ([3661464](https://github.com/delta-comic/delta-comic/commit/36614649c757b35b0d423a69be0a9fde09a108fe))


### pref

* 新版本发布触发 ([2b0e051](https://github.com/delta-comic/delta-comic/commit/2b0e0517c911311a783e8546436bc860ddfbcc3d))


### BREAKING CHANGES

* 插件底层大改，旧插件要完全重构
* 插件底层大改，旧插件要完全重构

## [1.3.0](https://github.com/delta-comic/delta-comic/compare/1.2.0...1.3.0) (2026-03-06)


### Bug Fixes

* **app:** [pub] 应用图标修复 ([7508ced](https://github.com/delta-comic/delta-comic/commit/7508ced96db321ed1a78bd9bfcfd2d8af38ae434))
* docs link error ([22f55e0](https://github.com/delta-comic/delta-comic/commit/22f55e04265f7a66d91fb0b15c452984172cf3b4))
* rust ([f17f105](https://github.com/delta-comic/delta-comic/commit/f17f105deda4fed0d3473a8463f7d38b41d13333))
* settings page ([ed9b307](https://github.com/delta-comic/delta-comic/commit/ed9b307191faaf905b5a7328df97c196a5fce11a))
* **ui:** 修复了顶栏在短列表滚动时出现抖动的现象 ([55f2a0f](https://github.com/delta-comic/delta-comic/commit/55f2a0f761c97600c66c544baf8376e22c466dfa))


### Features

* new sentry version ([546869a](https://github.com/delta-comic/delta-comic/commit/546869a1234fdf6106e71dc96b17341549c24a60))
* **ui:** 更好的markdown渲染样式 ([86c24b2](https://github.com/delta-comic/delta-comic/commit/86c24b29e6529000bd3f76868d7bc7aec55382be))

## [1.2.0](https://github.com/delta-comic/delta-comic/compare/1.1.4...1.2.0) (2026-02-22)


### Bug Fixes

* ci node [pub] ([330d86a](https://github.com/delta-comic/delta-comic/commit/330d86aaaf606d8ea037b1364b00dcae21f14005))
* **ci:** node 25 ([8ad2240](https://github.com/delta-comic/delta-comic/commit/8ad2240a276bb9d6b4162a04ebb10e5e3f094ffa))
* exec in bun ([43a523c](https://github.com/delta-comic/delta-comic/commit/43a523cddce8fc3c90f13f1399ed83699d2282e5))
* fmt config ([8b39543](https://github.com/delta-comic/delta-comic/commit/8b395439affacd4fb11e0fb0f272e528460791b8))
* git name [pub] ([1347806](https://github.com/delta-comic/delta-comic/commit/1347806553d0658e4c8eee4e9c1b4368a37f6122))
* semantic-release node ([0d54189](https://github.com/delta-comic/delta-comic/commit/0d54189c7b7077332edef123d9980e2c9a833b8d))
* un-imported component ([c9a1f22](https://github.com/delta-comic/delta-comic/commit/c9a1f229ededc4603b9dd285d6191c9fc6b76b19))
* wasm run ([d386ac7](https://github.com/delta-comic/delta-comic/commit/d386ac746bac72862aad76c531f8be6317bc7997))


### Features

* activated user ([f5437c7](https://github.com/delta-comic/delta-comic/commit/f5437c783292dbffd000017cfc9de19df35a0991))
* bun instead of pnpm ([389c46e](https://github.com/delta-comic/delta-comic/commit/389c46ec3256bb0d1ec7e8a38d22875f2324e9e8))
* wasm support ([ce75ed6](https://github.com/delta-comic/delta-comic/commit/ce75ed6983d15b360bc4547c01a8c8149b97d659))

## [1.1.4](https://github.com/delta-comic/delta-comic/compare/v1.1.3...1.1.4) (2026-02-12)


### Bug Fixes

* **ci:** [pub] env not configured ([5575ba8](https://github.com/delta-comic/delta-comic/commit/5575ba81cd81f47790b3ef8e4863fd595f25244f))
* **ci:** [pub] fullscreen fixed ([aaa4309](https://github.com/delta-comic/delta-comic/commit/aaa4309f81d8f3989dba3733a611bb747a97260f))
* fullscreen ([99e91f5](https://github.com/delta-comic/delta-comic/commit/99e91f5f2dcd5e7432f953dcc6eef3071428db9a))
* plugin download sort ([2394f5a](https://github.com/delta-comic/delta-comic/commit/2394f5ae3a8095f58dcdb08e6a5c0bc40191aa54))

## [1.1.3](https://github.com/delta-comic/delta-comic/compare/v1.1.2...v1.1.3) (2026-02-11)


### Bug Fixes

* [pub] android load ([#28](https://github.com/delta-comic/delta-comic/issues/28)) ([c09dcef](https://github.com/delta-comic/delta-comic/commit/c09dcef3b92cc91a4195b938eb244f3b403c9c68))

## [1.1.2](https://github.com/delta-comic/delta-comic/compare/v1.1.1...v1.1.2) (2026-02-11)


### Bug Fixes

* [pub] fix ([#25](https://github.com/delta-comic/delta-comic/issues/25)) by ([#26](https://github.com/delta-comic/delta-comic/issues/26)) ([9e07b02](https://github.com/delta-comic/delta-comic/commit/9e07b02599db19f551ace374c93a8fd8e8c1b44e))
* [pub] wf ([#27](https://github.com/delta-comic/delta-comic/issues/27)) ([6a726d3](https://github.com/delta-comic/delta-comic/commit/6a726d3e810d59de76189a1d69d2180fc0801351))

## [1.1.1](https://github.com/delta-comic/delta-comic/compare/v1.1.0...v1.1.1) (2026-02-09)


### Bug Fixes

* **build:** build frontend error ([#24](https://github.com/delta-comic/delta-comic/issues/24)) ([3a1bf4d](https://github.com/delta-comic/delta-comic/commit/3a1bf4de75dd2b3a14c680eae7c66243484f045d)), closes [#17](https://github.com/delta-comic/delta-comic/issues/17)

## [1.1.0](https://github.com/delta-comic/delta-comic/compare/v1.0.0...v1.1.0) (2026-02-08)


### Bug Fixes

* **build:** ci ([#23](https://github.com/delta-comic/delta-comic/issues/23)) ([d257532](https://github.com/delta-comic/delta-comic/commit/d257532cf21f55434a66ed13addd9a4d8d4e687a)), closes [#17](https://github.com/delta-comic/delta-comic/issues/17)
* **build:** config ([#22](https://github.com/delta-comic/delta-comic/issues/22)) ([7436a89](https://github.com/delta-comic/delta-comic/commit/7436a894f1dba936bf619d93815bb7294503fe37)), closes [#17](https://github.com/delta-comic/delta-comic/issues/17)
* **build:** readme fmt ([1203f66](https://github.com/delta-comic/delta-comic/commit/1203f6670ac2ce7e9ca0fc062f9d284b85d3471d))


### Features

* Better Net ([#21](https://github.com/delta-comic/delta-comic/issues/21)) ([088b0d9](https://github.com/delta-comic/delta-comic/commit/088b0d9aba0941ad460a1a8ea7a233dea779c7e0)), closes [#17](https://github.com/delta-comic/delta-comic/issues/17)

## 1.0.0 (2026-02-05)


### Bug Fixes

* actionBar style ([76d8c86](https://github.com/delta-comic/delta-comic/commit/76d8c862610eb5b665a20d57507480e217988fe1))
* apksigner ([3212934](https://github.com/delta-comic/delta-comic/commit/321293435b68646d794095d4915d1bdad41466cb))
* avator style ([76ade76](https://github.com/delta-comic/delta-comic/commit/76ade76e73c9988e202d583c34acc6e26a4dce27))
* build css error ([73a983e](https://github.com/delta-comic/delta-comic/commit/73a983e15b6e9501bc64ed3a091d4cadcd082a14))
* build error ([727c75c](https://github.com/delta-comic/delta-comic/commit/727c75c6160fcbb0dd9269540fa22e46ed9a5c7a))
* build script ([7ddcd6a](https://github.com/delta-comic/delta-comic/commit/7ddcd6a956cbb824beff0019e56a8c4759e92b5a))
* cache ([6f55da9](https://github.com/delta-comic/delta-comic/commit/6f55da93936fbfe6cbf9224460491ba7beb42da1))
* card ([2f79766](https://github.com/delta-comic/delta-comic/commit/2f79766fcb8aa072f46a9094428269a601b9baa3))
* cmdline-tools in workflow ([df6d112](https://github.com/delta-comic/delta-comic/commit/df6d112eac3cd67b1560825b79d68a78d1c44a0e))
* comment & actionPage ([43c0dae](https://github.com/delta-comic/delta-comic/commit/43c0dae243bd5d95fe76c121a6ba33cb98dc4601))
* comment row children button style in light ([85f1b7b](https://github.com/delta-comic/delta-comic/commit/85f1b7be9067ff5a48d2dcba542d232be56174c9))
* core lib ins bug ([5a958eb](https://github.com/delta-comic/delta-comic/commit/5a958eb4168b0f55e2160782fc60e85e25bd18ff))
* dark style ([b06eadb](https://github.com/delta-comic/delta-comic/commit/b06eadb8c366919f7c649c94c7b0766ef2e7cab0))
* download progress ([d2ff3ad](https://github.com/delta-comic/delta-comic/commit/d2ff3ad4ce15094bd77c879d8fe52bd905c1a09b))
* first boot app don't show content ([350fc18](https://github.com/delta-comic/delta-comic/commit/350fc18a5c28761f995f4de21e1baa109c6ce2e6))
* forget edit workflow file ([8d00b01](https://github.com/delta-comic/delta-comic/commit/8d00b01a07c971ea43045124c3e3dfac128acef8))
* history bug ([5b97c17](https://github.com/delta-comic/delta-comic/commit/5b97c1708bc48f022db33466d51924f956615d92))
* history popup & history item sort ([498f304](https://github.com/delta-comic/delta-comic/commit/498f304f7bdba7bb1703e24aa78361a0ba812f79))
* hot page type select ([16b8adf](https://github.com/delta-comic/delta-comic/commit/16b8adf378117100d710b18938b423a1a8c74741))
* icon ([a6d8074](https://github.com/delta-comic/delta-comic/commit/a6d807483ef14492fe2f20d5664f4afd98205856))
* images view exit full screen ([de79efa](https://github.com/delta-comic/delta-comic/commit/de79efa990cd6211b903c48d5162d604f79aa046))
* itemCard show ([0eeb34e](https://github.com/delta-comic/delta-comic/commit/0eeb34e9a0dd4289ab9e199ffa334adc78af1778))
* no level need hidden ([2b4ee39](https://github.com/delta-comic/delta-comic/commit/2b4ee3908a2b606701b0ccccb4aa1973c926e0ea))
* package.json without workspace ([664a90e](https://github.com/delta-comic/delta-comic/commit/664a90eabdce6ff826827ce34e6d2472021eb055))
* path ([adb9874](https://github.com/delta-comic/delta-comic/commit/adb98742177f85d022ee565f6c570051ba26819b))
* prod mode layer bug ([559ee61](https://github.com/delta-comic/delta-comic/commit/559ee617efcb1b5ef1972529768df8474450198c))
* r18g style error ([17e676e](https://github.com/delta-comic/delta-comic/commit/17e676e2d426896c9181d369ee12daaaa245de6a))
* readme ([b2788e0](https://github.com/delta-comic/delta-comic/commit/b2788e076d1d5dcfe033c0f41a32322c3633383f))
* readme card ([2cdeee0](https://github.com/delta-comic/delta-comic/commit/2cdeee02c251d925094922eb17dcc27dc5875bc5))
* readme title ([acd8076](https://github.com/delta-comic/delta-comic/commit/acd807696c830d190a0203c86c785b98978a0336))
* README.md with new card links ([c37c705](https://github.com/delta-comic/delta-comic/commit/c37c705d08f00efd366cd1f05dc5b9282db71471))
* refresh view ([f25cafc](https://github.com/delta-comic/delta-comic/commit/f25cafcb16adcf83fbeb7f2b7469341659ed4f46))
* sdk check in workflow ([8c254d2](https://github.com/delta-comic/delta-comic/commit/8c254d2e789dd39e1365f7250b0d252ef1ca35fa))
* search ([46868c8](https://github.com/delta-comic/delta-comic/commit/46868c8a8401bc6dbb25efcb9bec55a9dade28d4))
* search ([497af76](https://github.com/delta-comic/delta-comic/commit/497af76e534d9647d789729b1c439cc7db546a4e))
* search bar and subscribe safe area ([0bcbdfc](https://github.com/delta-comic/delta-comic/commit/0bcbdfc93d98651bc81c071b3d503029a09715ca))
* search router ([e4e7df7](https://github.com/delta-comic/delta-comic/commit/e4e7df740f4756473929dc0956be22f7cc7023c5))
* setup android in workflow ([8b5ca22](https://github.com/delta-comic/delta-comic/commit/8b5ca2276b7bfb9d8dbd3b433c255c9589f2b969))
* store bug & create router bug ([7ec00bf](https://github.com/delta-comic/delta-comic/commit/7ec00bfbe03df7ac40196a8753caedbe919f41ae))
* style ([e469b3c](https://github.com/delta-comic/delta-comic/commit/e469b3c00b542b440a2315193a30d6cf88ec8b93))
* style ([544ffdc](https://github.com/delta-comic/delta-comic/commit/544ffdc5085c51c61df4a7aecd2d8ec44bbbeefa))
* subscribe list empty icon & view back router & comment row user ([f42d110](https://github.com/delta-comic/delta-comic/commit/f42d11091ed3097a22ac303c690a4aba17c29267))
* sync ([11f867c](https://github.com/delta-comic/delta-comic/commit/11f867cf5a850b0bb3edddd6f62c3ba35b4db84c))
* update ([74313e4](https://github.com/delta-comic/delta-comic/commit/74313e43ab0ecd7f43ea8ff7b8ecf2f9329b633b))
* version in workflow ([c2b497a](https://github.com/delta-comic/delta-comic/commit/c2b497adcf968be5bd357f601b7c7a6ccbe32d4f))
* video view async function ([a3bc0ce](https://github.com/delta-comic/delta-comic/commit/a3bc0ce5ebf583f7a4ea6c3b3794140656d9a405))
* wf ([3896f1d](https://github.com/delta-comic/delta-comic/commit/3896f1dd40fe4d4569b17ddefeac00e30775a51b))
* workflow ([c9901d0](https://github.com/delta-comic/delta-comic/commit/c9901d00494430bc2cc6232b48d5f727e39c3552))
* workflow ([b730482](https://github.com/delta-comic/delta-comic/commit/b730482f1b6d7685cc07362250f4660fc953cccd))
* workflow aim ([e2f0744](https://github.com/delta-comic/delta-comic/commit/e2f07442271e231cfc2a97e4ed5e5dd4b324d8ab))
* Workflow build only start with 'v' ([#16](https://github.com/delta-comic/delta-comic/issues/16)) ([010133a](https://github.com/delta-comic/delta-comic/commit/010133a21bc0afe1700a3c407f223229885a46d4))
* workflow pnpm ([9f7d959](https://github.com/delta-comic/delta-comic/commit/9f7d9598f94789a3701e29448a93113ae73f02fe))
* workflow pnpm install ([f964e65](https://github.com/delta-comic/delta-comic/commit/f964e6597d940cface9f26e72bc90f38f32cf1a2))
* workflow release ([8302a6a](https://github.com/delta-comic/delta-comic/commit/8302a6ae65406739a3eca6b20bf9da0ae630e99b))


### Features

* add plugin ([ab5e3b0](https://github.com/delta-comic/delta-comic/commit/ab5e3b0b21e4c95d7980cfbc5797a497c595760a))
* async load & depend tree ([01818e6](https://github.com/delta-comic/delta-comic/commit/01818e64230eb669cde67fcf4e1539dab1d45cf5))
* barcode route in search page ([2b598c7](https://github.com/delta-comic/delta-comic/commit/2b598c77cdc09df1ec6da17ec5d6a0b8b3a9188e))
* better video view ([02da14b](https://github.com/delta-comic/delta-comic/commit/02da14bffa8aab653f2e45befee9aeb35d85ee9c))
* change app icon ([dbf9aac](https://github.com/delta-comic/delta-comic/commit/dbf9aacc0929376cab8ee00b425d1b2a033329ed))
* coll ([e47f008](https://github.com/delta-comic/delta-comic/commit/e47f008ce854becebec48e94f3463abf2f0d4f59))
* comment ([bc7e73e](https://github.com/delta-comic/delta-comic/commit/bc7e73e6ef9f4965f522c9e4ba5364e73a0b805b))
* config & setting & user preview & ep fix ([f2d40f8](https://github.com/delta-comic/delta-comic/commit/f2d40f8507c1c19a0d8e13eee4f0051b4a5a070b))
* config adopted & core plugin ([8f9e095](https://github.com/delta-comic/delta-comic/commit/8f9e095fb37625812d62e8567ef3384ae49f7b5b))
* cosav ([f2fb2cd](https://github.com/delta-comic/delta-comic/commit/f2fb2cddd78bd44ec564a5a5540c1abd8be077ad))
* dark mode & unsafe check ([ddb8154](https://github.com/delta-comic/delta-comic/commit/ddb8154a9b7e269a6bc24d91f3a381ca3d9d8097))
* download repo plugin & user action ([4ac2880](https://github.com/delta-comic/delta-comic/commit/4ac288054a1fa9ec6a767dba12e84df438486d04))
* dyn proxy server ([cb4c935](https://github.com/delta-comic/delta-comic/commit/cb4c9358541950388ed76bfc574c2fe48b19b13b))
* fav db done ([52d54c4](https://github.com/delta-comic/delta-comic/commit/52d54c4430395136399176e9a8728f3aa66dfb3d))
* favourite all done ([15005a8](https://github.com/delta-comic/delta-comic/commit/15005a884bbb7818ffa22d49b7f136e7de0ad79f))
* favourite save ([359e046](https://github.com/delta-comic/delta-comic/commit/359e046c6d0bfa0dc97e0fe0abe8301830a54029))
* full impl of barcode route ([708c206](https://github.com/delta-comic/delta-comic/commit/708c206526eaadbeda6dacd941bd61e25f964910))
* history ([f780b3e](https://github.com/delta-comic/delta-comic/commit/f780b3e4f73781a80fad5b02ba9308377ce9e052))
* history and bugs ([8980afb](https://github.com/delta-comic/delta-comic/commit/8980afb3b059660f83e748cdaab7fb8f4d6b5ed3))
* history prototype ([334e57d](https://github.com/delta-comic/delta-comic/commit/334e57daf0bc1eb7ce899d27bc5f7d3b6a16dcde))
* hot list ([55070f8](https://github.com/delta-comic/delta-comic/commit/55070f8f1122398157ca225a64ac4d0890db3aac))
* hot page prototype ([92474a7](https://github.com/delta-comic/delta-comic/commit/92474a7d2c4af580e94aed9ae67241e92472c7da))
* hot update ([ed18a13](https://github.com/delta-comic/delta-comic/commit/ed18a130392b262b03f553eb9f06d223215a3649))
* icon ([8732508](https://github.com/delta-comic/delta-comic/commit/873250847e4331ceda18cc4ae43269e9eb30c7b1))
* jm comments ([f9e6def](https://github.com/delta-comic/delta-comic/commit/f9e6def7f5cc3a552f9b8a009b2645b393d842b7))
* jm level board ([fddce01](https://github.com/delta-comic/delta-comic/commit/fddce0106182f7682483adb4f7e77a4f4f56918e))
* jm premote ([4955fda](https://github.com/delta-comic/delta-comic/commit/4955fdab427b8f114554b0a7eda2247d84200e24))
* jm user ([7960972](https://github.com/delta-comic/delta-comic/commit/7960972a55e062f2c83ddd25b76a1be94d943883))
* jm wiew ([01537e5](https://github.com/delta-comic/delta-comic/commit/01537e5f59a4e43fb705130b2b7f65f7218bca76))
* level index show ([c8788db](https://github.com/delta-comic/delta-comic/commit/c8788dbee1c69bf7dfd98c211d6eac83962ef738))
* levelboard show ([57d01d2](https://github.com/delta-comic/delta-comic/commit/57d01d20b9e8a02b89c437c4df58ce3d77cac6f0))
* many ([c226a27](https://github.com/delta-comic/delta-comic/commit/c226a27d4b707d144d42c0b2082d8eccd7eaad83))
* many ([1e4946d](https://github.com/delta-comic/delta-comic/commit/1e4946d0d2631f1a52ed2322ea6ce8bc7cc7a5eb))
* max view ([af44a19](https://github.com/delta-comic/delta-comic/commit/af44a1980b78f5572756e7354c86947bb4556bed))
* plugin ([10fc8a0](https://github.com/delta-comic/delta-comic/commit/10fc8a08a93b45b2fe961013f5c87f37a4dbc897))
* plugin system ([b668cb1](https://github.com/delta-comic/delta-comic/commit/b668cb1aa70d98bb357cd9f6043f17144509a615))
* random page ([2f00fcb](https://github.com/delta-comic/delta-comic/commit/2f00fcbe6d9851046058aeb7db920e1d6d24c627))
* re-struct code ([149df45](https://github.com/delta-comic/delta-comic/commit/149df45018d865f6b23ca7ad3515aed2ef7344ed))
* search ([8773d91](https://github.com/delta-comic/delta-comic/commit/8773d91954a8f0d4f1f8b55bffe7daac30e3c16f))
* search & recent view & tabbar & cate ([8363939](https://github.com/delta-comic/delta-comic/commit/8363939bc1c22137b3f515d50a099046a2150fb3))
* search auto complete & hot page style & view fix & author remake ([8bd3532](https://github.com/delta-comic/delta-comic/commit/8bd3532e2ee778705965f412a4ae9747858bcebf))
* share token listen ([1599ea7](https://github.com/delta-comic/delta-comic/commit/1599ea7b4a1cf94858eb14dc6299c0c5e992a8be))
* shared router ([39f0331](https://github.com/delta-comic/delta-comic/commit/39f0331fef62922fd71c64681d0dc56f040e4092))
* status bar ([1ebc892](https://github.com/delta-comic/delta-comic/commit/1ebc8925c2088f04cb8b1141918dc445ed8ec164))
* subscribe view ([8c5b4f0](https://github.com/delta-comic/delta-comic/commit/8c5b4f0a4a3c82c05ca93cf06660a5445a0688c6))
* support core version check ([9d247a1](https://github.com/delta-comic/delta-comic/commit/9d247a1d180e78c1e3aa364dc57973a53b71eb1a))
* uni search ([f8c65c0](https://github.com/delta-comic/delta-comic/commit/f8c65c058a3747c04fee04497c49164654cdbfff))
* unit view ([cc85b54](https://github.com/delta-comic/delta-comic/commit/cc85b54fffa8a6a8870e8c36aed3c5e38e22d795))
* user & history & favourite ([9525a43](https://github.com/delta-comic/delta-comic/commit/9525a4367b2dfe378bc9dec5e3781440c1f4e42a))
* watch and based search ([3faf9c7](https://github.com/delta-comic/delta-comic/commit/3faf9c71ee660d3c12455d809407edc26828c8de))
* water fall ([29d0a60](https://github.com/delta-comic/delta-comic/commit/29d0a601f8c3f1c397853b2851f7a0dbae87f47f))
* week best ([ea02369](https://github.com/delta-comic/delta-comic/commit/ea02369c3f929e31ff29b2f1be6987f3aedff312))
