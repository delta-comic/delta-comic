# 任务清单

你现在着手完成以下内容，不分先后。你自己决定工作顺序

此外，你可以**任意的**添加依赖和增删monorepo

适当的用git提交(不推送)保存分割工作进度

你可以切分子任务来更好的规划进度

该清单内容位于`项目根目录/TODOS.md`

---

## app侧清单

- [x] 现在收藏夹的点击有bug，点击后无法路由，请你修复
- [x] 现在点击主界面的搜索框是就地开始搜索，请你改为单独路由到搜索页面，样式参照[照片p1](docs/todos/search.jpg)。关于热搜词，你应当添加插件接口
- [x] 收藏夹列表应当有两种样式，但现在只有一种，第二种参照[照片p2](docs/todos/favList.jpg)，对于现在无法实现的内容，点击后弹出错误信息
- [x] 参照[照片p3](docs/todos/main.jpg)的bottomBar重现现在的样式
- [x] 添加一个开屏界面等待加载，直到preboot插件完成加载后隐藏。
  - [x] 竖屏样式要为一个[setup.avif](packages/app/public/setup.avif)占据屏幕纵向2/3，同时底部写着`Delta Comic`，正如现在的`packages/app/src/AppSetup.vue`的`template/AnimatePresence/template`那样
  - [x] 桌面端样式是一个没有框架的纯白色/黑色的底配上首字母大写加粗斜体花体的`Delta Comic`几乎沾满窗口(留20%padding)
