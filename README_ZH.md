<div align="center">
  <h1>TrayX</h1>
  <p><strong>一个以桌面端为主的 Obsidian 插件，用于通过系统托盘或菜单栏持续访问当前库窗口。</strong></p>
  <p><a href="README.md">English</a> | 中文 | <a href="CHANGELOG.md">Changelog</a></p>
</div>

## 功能简介

- 在 Windows 上通过系统托盘图标、在 macOS 上通过菜单栏图标保持当前桌面库可随时恢复。
- 支持通过托盘、菜单栏和命令面板显示、隐藏或切换当前库窗口。
- 启用后台模式后，关闭主窗口时会隐藏窗口而不是直接退出。
- 支持启动时隐藏、登录时启动，以及 TrayX 运行期间隐藏应用图标。
- 提供运行时诊断，可查看 bridge 选择、托盘状态、托盘所有者、恢复路径、图标健康状态和关闭拦截状态。
- 保持本地优先，不引入网络请求、遥测或远程代码执行。
- 运行时会跟随 Obsidian 默认语言：
  - 所有 `zh*` 语言码统一显示为简体中文
  - 其他语言显示为英文

## 项目进度

TrayX 已经完成桌面端托盘常驻、隐藏恢复和运行时诊断的核心闭环。下面的清单用于标记当前已完成的能力，以及后续会继续打磨的方向。

- [x] 在 Windows 提供系统托盘集成，在 macOS 提供菜单栏集成，并面向当前桌面库工作。
- [x] 提供切换显示、显示、隐藏、重新启动、关闭当前库和显示运行时诊断等命令。
- [x] 提供托盘图标、后台运行、启动时隐藏、登录时启动和隐藏应用图标等设置项。
- [x] 通过托盘 owner 协调，保证同一个库同一时间只有一个 live window 拥有托盘。
- [x] 提供覆盖 bridge、capability sources、托盘状态、恢复路径、关闭拦截、托盘路径、图标状态和托盘边界的运行时诊断。
- [x] 完成设置、命令、托盘菜单、notice 和 diagnostics 的英文与简体中文本地化。
- [x] 通过 fake-based 单元测试覆盖托盘生命周期、恢复策略、诊断、窗口显隐和本地化行为。
- [ ] 继续补强跨平台托盘与恢复行为的手动发版验证。
- [ ] 继续增强重复关闭和恢复流程、bridge fallback 场景下的可观测性与诊断信息。
- [ ] 继续打磨托盘和菜单栏图标在不同平台上的交互细节与视觉可读性。
- [ ] 随着插件稳定性提升，持续完善桌面端回归覆盖和发布说明。
- [ ] 只有在当前桌面范围足够稳定后，再重新评估更宽的平台或功能扩展。

路线会优先服务桌面端稳定性、可观测性和可恢复性。

## 平台与运行时说明

- TrayX 是桌面专用插件，因为它依赖 Electron 和 Node API。
- macOS 使用插件根目录中的 `trayTemplate.png` 和 `trayTemplate@2x.png` 作为自适应 template 菜单栏图标资源。
- macOS 交互保持左键恢复或显示、右键打开托盘菜单。
- Windows 使用生成的托盘图标，并保持点击切换显隐和可访问的托盘菜单。
- 在 macOS 上隐藏应用图标会影响整个 Obsidian 应用的 Dock 可见性，而不只是当前库。
- Tray owner 会按库同步，保证同一库只有一个 live window 负责托盘。

## 使用方法

1. 在桌面端库中启用 TrayX。
2. 保持 **启用托盘图标** 开启，这样当前库才能继续通过托盘或菜单栏恢复。
3. 使用托盘图标、菜单栏图标，或命令面板来显示、隐藏或切换当前库窗口。
4. 如果你希望关闭主窗口时不退出 Obsidian，而是隐藏当前库，请开启 **后台运行**。
5. 按需启用 **启动时隐藏**、**登录时启动** 或 **隐藏应用图标**。
6. 如果托盘行为异常，请运行 **显示运行时诊断**，检查 bridge、托盘就绪状态、恢复路径和图标状态。

## 设置项

| 设置项 | 说明 |
| --- | --- |
| 启用托盘图标 | 为当前库显示系统托盘或菜单栏图标。 |
| 后台运行 | 关闭应用窗口时改为隐藏窗口，而不是直接关闭。 |
| 启动时隐藏 | 启动后根据当前后台行为隐藏或最小化窗口。 |
| 登录时启动 | 在这台设备登录时自动打开应用。 |
| 隐藏应用图标 | macOS 上会在 TrayX 运行时隐藏 Dock 图标，Windows 上会在 TrayX 运行时隐藏任务栏中的窗口可见性。 |

## 命令

- `切换库可见性`
- `显示库`
- `隐藏库`
- `重新启动应用`
- `关闭库`
- `显示运行时诊断`

TrayX 不提供默认快捷键。你可以在 **设置 → 快捷键** 中自行绑定。

## Diagnostics

`显示运行时诊断` 适合在托盘行为不符合预期时优先使用。它会暴露当前桌面运行时状态，包括：

- bridge choice
- capability sources
- tray readiness
- last tray refresh error
- tray owner
- restore path
- restore blocker
- close interception state
- tray path
- `trayIconExists`
- `trayIconEmpty`
- `trayIconTemplate`
- tray bounds

当托盘图标没有出现、当前库无法恢复，或后台隐藏被安全降级时，这个诊断输出尤其有用，因为它现在也会明确说明最近一次托盘刷新失败，以及当前恢复链路被什么原因阻塞。

## 当前限制与恢复边界

- 当前版本保持桌面专用范围，`manifest.json` 会继续保持 `isDesktopOnly: true`。
- 如果当前环境不存在安全可恢复的恢复路径，TrayX 会避免把用户留在不可恢复的后台关闭状态中，diagnostics 也会反映这一降级模式。
- 命令名称会在插件加载时根据 Obsidian 语言注册；如果运行中切换语言，命令名称可能需要重载 TrayX 或重启 Obsidian 后才会在所有地方刷新。
- 托盘菜单会在托盘重建时跟随当前语言更新。
- TrayX 只管理当前库的桌面窗口，不会协调无关库的窗口状态。
- 插件不引入网络请求、遥测或远程代码执行。

## 开发

```bash
npm ci
npm run dev
```

常用命令：

- `npm run test:unit`
- `npm run lint`
- `npm run build`

`main.js` 会在本地或 CI 的构建与发布流程中生成。仓库只跟踪源码和发布元数据，不跟踪生成后的 bundle 文件本身。

## 发布文件

手动安装或发布时，请将以下文件复制到：

`<vault>/.obsidian/plugins/trayx/`

- `main.js`
- `manifest.json`
- `styles.css`
- `trayTemplate.png`
- `trayTemplate@2x.png`

## 发版检查清单

正式发版前请运行：

- `npm run test:unit`
- `npm run lint`
- `npm run build`

在打包或上传发布资产之前，应先通过构建重新生成 `main.js`。

然后在一个干净的桌面测试库里手动验证：

- 插件加载时没有新的 runtime notice
- `显示运行时诊断` 能反映真实运行状态
- 托盘或菜单栏图标可见且交互正常
- `Cmd+W` 关闭与恢复行为符合预期
- `Cmd+Q` 和应用菜单退出行为正常
- 重复关闭和恢复不会创建重复托盘
- 在 macOS 上，托盘资源路径为绝对路径且 template 图标状态正常
- 在 Windows 上，小尺寸托盘图标仍然清晰可辨

## 隐私与安全

- TrayX 不会发起网络请求。
- TrayX 不会收集遥测数据。
- TrayX 不会执行远程代码。
- TrayX 仅通过本地 Electron API 管理当前桌面库窗口。

## 致谢

TrayX 的设计参考并部分改编自 [dragonwocky/obsidian-tray](https://github.com/dragonwocky/obsidian-tray)，其许可证为 MIT License。

## License

MIT
