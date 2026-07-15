# 任务清单

你现在着手完成以下内容，不分先后。你自己决定工作顺序

此外，你可以**任意的**添加依赖和增删monorepo

适当的用git提交(不推送)保存分割工作进度

你可以切分子任务来更好的规划进度

该清单内容位于`项目根目录/TODOS.md`

---


## app侧清单

- [ ] 开屏界面现在是糊弄的实现，你现在将其重构为：
  - [ ] 移动端和桌面端使用原生窗口和page实现，这可能需要设计`tauri.conf.json`或其他原生代码
  - [ ] 网页端使用iframe置顶显示其他入口实现
  **这些都需要重构app为多入口应用，这也利于以后扩展**
  为什么我说现在是糊弄的实现：现在直接加载这个很重的html会导致明显的延迟卡顿，所以宁可增加切页时间也要实现流畅的用户体验
- [ ] 通过安装`@tauri-apps/api`npm包实现更好的判断环境，而不是使用自制的检测逻辑
- [ ] 关于app的hairline的实现重构为参照<https://github.com/youzan/vant/blob/main/packages/vant/src/style/mixins/hairline.less>的实现，但仍使用css而不是less，利用tailwindcss的高可扩展机制将其重构为它的组件类
- [ ] 利用tailwindcss的机制，将现有的css和旧工具类全部重构

## server侧清单

- [ ] 利用tailwindcss的机制，将现有的css和旧工具类全部重构

## 项目工程清单

- [ ] 规范化项目分支和版本系统: main->正式版发布(ci自动); next->预览版发布(ci自动); develop->不发布
  - [ ] 配套设计便捷的指令，使得人工可以便捷的切换分支发布
