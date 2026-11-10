# 小云 · 规则与演练

Skivu 小云插件，基于 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 1.1.71，原作 Copyright (c) 2026 小杨。适配源文件、原 LICENSE、README 署名和附加使用说明保留在 [plugins/purge/upstream](plugins/purge/upstream)。本插件免费分发。

**需要 Skivu 0.2.96 或更新版本。** 在 App 的“插件 → 开放插件与开发者”安装并启用“小云 · 规则与演练”，或从小云工作区打开。安装后仍需确认权限。它直接使用已经合并进小云的内置 Linux、Node、SQLite 和任务执行能力，无需独立 DSH 应用。

支持提示词与多规则、草稿和应用/撤销、22 份技能正文、演练资产/服务/发现项/证据/凭据/访问状态/会话与隧道资料、攻击链、评分、报告、知识库、角色提示词，以及完整资料库备份、校验恢复和历史版本切换。报告通过 Android 文件选择器保存；图片附件随完整资料库备份导出。

Windows 安全中心隔离了原包的 `unauth-exploit.md`，此正文未重新包含。目录保留其来源和摘要并明确不可用，合计 23 个目录条目、22 份可读正文。正文可读不代表相关外部工具或密钥已安装。

DSH 源码、ASAR、审批和重启补丁在 Skivu 中不适用。原专用并行智能体运行器和 TCP 探测未启用；代码执行、手机操作和任务恢复使用小云既有能力。原身份替换与忽略限制提示词不会自动应用。保存资料不等于外部操作已完成，结果以实际执行回执为准。

## 安装与源码

市场 ID 为 `org.skivu.purge`。可导入 [1.0.1 安装包](packages/skivu-purge-1.0.1.skivu.json)。1.0.1 的界面及执行逻辑与 App 内置 1.0.0 相同，更新了发行版本号及适配版源码地址，支持从市场识别更新。上游来源、作者和许可证仍随包保留。

源码从 Skivu 适配提交 `9f89bfb6774c086ce1895c68a2876e0821f4280b` 中的插件目录导出，没有包含用户资料、模型密钥或服务器运维文件。仓库里的 `upstream/` 为来源留档；不要运行原 DSH 安装或补丁脚本。

```sh
cd plugins/purge
npm ci --ignore-scripts
npm run build
npm test
```

使用 Node 24 或更新版本。构建产物在 `plugins/purge/dist/`；同时生成用于宿主集成的 `android/app/src/main/assets/cloud/lab.mjs` 与 `assets/plugins/skivu-purge.skivu.json`。宿主接口由 Skivu 0.2.96 提供。构建使用锁定依赖，未运行上游安装脚本。测试只用本地 SQLite 和离线样例，不向目标发起操作。

详见[适配说明](plugins/purge/README.md)和[源文件清单](plugins/purge/PROVENANCE.json)。独立提示词、技能和资料库 API 均通过小云现有 SDK 授权；资料库按插件隔离，只读工具不能写，目标相关写入需明确演练编号，未知回执不自动重试。
