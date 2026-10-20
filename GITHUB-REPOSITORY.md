# GitHub 仓库说明

这个仓库保存《侏罗纪城市公园》项目中自己编写的建造、交通、恐龙、校验和导出工具，方便以后复用、检查和继续开发。

## 保留内容

- `map/`：城市、公园、围场、观光轨道和建筑细节的生成脚本；`map/generated/` 是本机生成结果，不纳入版本库。
- `builder/`：自制 NeoForge 1.21.1 建造模组的源代码和构建配置。
- `runtime/`：服务端控制、启动、导出、交通和录制辅助脚本；运行中的世界、日志和模组文件不纳入版本库。
- `tools/`：建筑审计、恐龙音频准备、世界快照和车辆计划等自制辅助脚本。
- `verification/`：地图和存档校验脚本，以及验收说明；机器生成的大型快照和二进制文件不纳入版本库。
- `modpack/manifest.json` 等版本清单和配置文件，用于记录依赖版本与校验值；第三方模组文件本身不上传。

## 使用前提

- Minecraft Java 1.21.1
- NeoForge 21.1.262
- JDK 21（编译自制模组时使用）
- Node.js 20 或更高版本
- 需要的第三方模组、资源包和世界存档请按 `modpack/` 中的清单自行准备。

## 常用命令

```powershell
npm install
npm run generate
npm run check
```

`npm run generate` 只生成建造计划，`npm run check` 检查计划结构。将计划应用到世界前，请先阅读 `README.md` 和 `runtime/BUILD-WORLD.md`，不要对个人存档直接执行批量建造。

编译自制模组：

```powershell
cd builder/MDK-1.21.1-ModDevGradle-main
./gradlew.bat build
```

构建结果在该目录的 `build/libs/`。代码中包含批量施工 `ParkBuilder`、自动交通 `CityTraffic`、恐龙音效 `DinosaurAudio`、录制镜头 `ParkCameraClient`、地图检查与轨道测试工具。

## 使用范围与历史记录

这是现有项目的工具归档，不是下载后就能运行的游戏整合包。部分 PowerShell 脚本保留原作者机器的 Minecraft 和 Java 默认路径，使用前需要按本机位置调整。启动、施工、修补和导出脚本会读写存档，建议只用于备份副本。

`README.md` 和 `verification/` 的验收文字记录了不同日期的本地世界状态；它们不代表仓库内包含完整存档，也不代表所有历史功能都重新实测。旧版 Automobility 车辆方案也保留供参考，当前交通方案以主说明中的 Immersive Vehicles 方案为准。

第三方建筑原文件不上传；来源和校验值保留在 `map/references/assets/asset-manifest.json`。导入脚本需要自行准备对应素材。uNmINeD 的自制调用脚本位于 `tools/unmined/render-map.ps1`，运行前需自行安装对应 CLI。自制车辆资源包的纹理与模型一并保存。

## 本次上传前检查（2026-10-20）

在独立临时目录运行原始计划生成器和 `check-map.mjs`，没有改写现有地图计划或存档。计划生成成功；检查结果为 24 项通过、2 项待补数据、0 项错误。待补项是站台部分净空数据和服务端轨道实测日志，因此报告状态仍是 `pending`。本次没有重新进入游戏验收，也没有重新编译 Java 模组。

## 版权与第三方内容

本仓库保存项目自制代码、配置和说明，并保留构建所需的 Gradle Wrapper 与模板许可。Minecraft、Jurassic Reborn、NeoForge、Immersive Vehicles、第三方车辆包、JourneyMap 及其他依赖属于各自作者；使用时请遵守它们的许可和分发规则。
