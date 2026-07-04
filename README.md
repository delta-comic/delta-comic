<p align="center">
    <img alt="logo" src="./packages/app/public/favicon.png" width="120" height="120" style="margin-bottom: 10px;">
</p>

```ts
_____   _________________ ____        __________________ _____   ______
|  __ \|  ____|| |__   __| __ \      / ______\   |  \/  |_   _| / _____\
| |  | | |__   | |  | |  | | \ \    | |    _____ | \  / | | |  | /
| |  | |  __|  | |  | |  | |__\ \   | |   /  _  \| |\/| | | |  | |
| |__| | |____ | |__| |  |  ___\ \  | |___| |_| || |  | |_| |_ | \_____
|_____/|______||______|  |_|    \_\  \__________/|_|  \_______| \______/
=========================================================================
  Per aspera Ad astra                                Copyright © Wenxig
```

<p align="center">
    <a href="https://github.com/delta-comic/delta-comic/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/delta-comic/delta-comic" alt="Repo License" />
    </a>
    <a href="https://github.com/delta-comic/delta-comic/releases/latest">
      <img src="https://img.shields.io/github/downloads/delta-comic/delta-comic/total" alt="GitHub Downloads (all assets, all releases)" />
    </a>
    <a href="https://wakatime.com/projects/delta-comic">
      <img src="https://wakatime.com/badge/user/018cf362-35ff-48f2-af6b-61f09a441de4/project/9f2c18ca-6eec-4e82-8041-5d23c1aba440.svg" alt="Wakatime" />
    </a>
</p>

---

> 为什么不更新：在等vue3.6

## 为什么选择 Delta Comic

- **多源合一**: 通过插件把多个站点的内容统一呈现，无需在各站点间切换。
- **用户优先**: 界面与阅读体验为中心，支持主题切换、夜间模式等常见阅读习惯。
- **人性化UI**: 仿**BiliBili**的移动端界面，经过市场验证，使用更舒心。
- **开源与可扩展**: 插件模式让更多站点能快速接入（对普通用户透明）。
- [**评论区戳我**](https://github.com/orgs/delta-comic/discussions/32)!: _就是github的discuess_
- **人类主导**: 匠心程序员手作ui。

## 实机演示

| [![content](docs/content-1.webp)](https://github.com/delta-comic/delta-comic/releases/latest) | [![content](docs/content-3.webp)](https://github.com/delta-comic/delta-comic/releases/latest) | [![content](docs/content-2.webp)](https://github.com/delta-comic/delta-comic/releases/latest) |
| :-------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------: |

| [![main](docs/main-1.webp)](https://github.com/delta-comic/delta-comic/releases/latest) | [![hot](docs/hot-1.webp)](https://github.com/delta-comic/delta-comic/releases/latest) | [![user](docs/user-1.webp)](https://github.com/delta-comic/delta-comic/releases/latest) |
| :-------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------: |

## 如何使用

### Android

1. 安装应用
2. 在下文所提及的插件中选择一些安装
3. 启动！

### 插件集合

[![Readme Card](https://wenxig-grs.vercel.app/api/pin/?username=delta-comic&repo=awesome-plugins&user&theme=transparent)](https://github.com/delta-comic/awesome-plugins)

## 仓库构成

> 仓库一共有三个部分构成

1. **阿赖耶识**: 对应app包，移动应用的入口
2. **南天门直梯**: 对应server包，云服务的入口
3. **空阙虱楼**: 对应其他所有包，拆分依赖给外部插件

## 已实现内容

> 代码块内是下载命令

- [x] 禁漫天堂 `ap:jmcomic` -_天堂支点_
- [x] 哔咔漫画 `ap:bika` -_三花聚顶_
- [x] CosAv `ap:cosav` -_众生相_
- [ ] E-Hentai -_应许之地_
- [ ] 糖心Vlog _心外无物_

## 状态

<a href="https://www.star-history.com/?repos=delta-comic%2Fdelta-comic&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=delta-comic/delta-comic&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=delta-comic/delta-comic&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=delta-comic/delta-comic&type=date&legend=top-left" />
 </picture>
</a>

![Alt](https://repobeats.axiom.co/api/embed/d29bef6ede7cc9fcfabb0d1499a656e06f5462bf.svg 'Repobeats analytics image')

## 声明

> [!IMPORTANT]
> **本项目主要用于技术研究与自用，尊重内容原作者与平台规则，下载后请于24小时内删除；使用时请遵守相关法律法规与站点条款。**

> [!IMPORTANT]
> **在您获取并使用本应用程序的任何情况下，均视为您已充分理解并同意：开发者对因本软件引发的任何直接或间接损失、损害或后果不承担任何责任。**
> **一旦您开始使用本软件，即表示您已自愿放弃向开发者追究相关责任的权利。**

## 技术细节

tauri + vue3 + tailwindcss4
