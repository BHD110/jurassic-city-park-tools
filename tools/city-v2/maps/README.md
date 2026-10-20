# 游戏内城市全图：JourneyMap

## 文件

- `journeymap-neoforge-1.21.1-6.0.9.jar`：Minecraft 1.21.1、Java 21、NeoForge 21.1.228+。当前目标 NeoForge 21.1.262 满足最低要求。仅此一个 JAR，无额外依赖。
- `journeymap-modrinth-version.json`：Modrinth 官方版本 API 原始元数据，含下载地址、版本、平台和 SHA512。
- SHA512：`8900ee4cdb7d1ffb6559decdeec84ad479d04b2e7b01a60be9f6e328809af2bfd7a80077b7da0e49bc96261fe8fe274ba33c62f6c9f65302c783ed823c4ff746`（下载后与 API 校验一致）。

官方来源：https://modrinth.com/plugin/journeymap/version/1.21.1-6.0.9%2Bneoforge
官方安装文档：https://teamjm.github.io/journeymap-docs/latest/client/installing/

## 安装和初始化

1. 关闭 Minecraft，把上述 JAR 复制到**实际游戏实例**的 `mods` 文件夹。不要复制到存档 `mods` 子目录；先确认启动器当前实例的游戏目录。已有其他地图模组时，先检查按键冲突。
2. 备份世界，在单人模式加载**实际要玩的城市世界**，站在主世界地表。按 `J` 打开全屏地图。
3. 在 JourneyMap 中执行 `J > Actions > Automap > All Regions`（界面文字可能略有差异）。它从存档已存在的 Anvil 区域文件读图区块，因此能一次画出已经建造/生成的地方，无需逐格走访。执行期间保持世界打开、耐心等待完成。需要调整速度，可到 `J > Options > Advanced > AutoMap Poll Frequency`；官方旧版文档提到可调至 500ms，但在新版本里应以实际界面为准。
4. 缩放/拖动全屏地图检查 `x,z = -1000..1000` 范围。Automap 只处理当前维度及当前地表/洞穴层；要看主世界公园全貌，应在主世界地表执行。**从未生成的区块没有建筑可显示**，Automap 不会凭空生成或重建；若边界内有空白，先核对世界副本是否真的包含这些区块。
5. 默认 `J` 开全屏地图、`Ctrl+J` 开关小地图、`B` 新建路标、`N` 路标管理。若原有模组占用这些键，在 Minecraft 的“选项 > 控制 > 按键绑定”里修改冲突项。官方按键表：https://teamjm.github.io/journeymap-docs/latest/client/basic-usage/

官方 Automap 指南（旧版，但描述了单人世界从现有 region 文件绘图和当前维度/层限制）：https://teamjm.github.io/journeymap-docs/5.9.x/tools/multiplayer-server/

这里只准备了经哈希验证的 JAR 和操作方案；未改动实际实例，也未在游戏中执行 Automap，因此全图结果尚未现场验证。
