# Jurassic Reborn 城市公园模组包

当前城市车辆使用 Immersive Vehicles `24.0.0`、官方内容包 V29 和 Blue Seoul Vehicles `6.0`，车型包括 Hyundai/Kia 轿车及 Hyundai 城市巴士。原 Automobility 和旧车身资源包已退役。全城部署计划位于 `map/generated/iv-traffic.json`：81 条路线、1201 辆车（105 辆巴士）。`verification/iv-traffic-road-gaps.json` 记录 42 段道路的投影检查，初始车辆最大间隔 55 格。服务端 `citytraffic` 控制器生成真实 IV 车辆，并按普通混凝土道路路线驾驶。两辆抽样车（Sonata 轿车、County 巴士）已确认有发动机和车轮，且 8 秒内分别行驶约 114 格、83 格；存档实有 1201 辆、巴士 105 辆，见 `verification/iv-traffic-save.json`。控制命令依次为 `citytraffic probe`、`citytraffic start`、`citytraffic audit`。

JourneyMap `6.0.9` 按 J 打开全屏地图。Easy NPC Core 和 Easy NPC Config UI 均为 `7.15.0`，用于城市行人。

目标实例是 HMCL 的 `1.21.1-NeoForge`，运行目录为 `D:/codeSource/product/jev/mindcraft-client/.minecraft/versions/1.21.1-NeoForge`。模组文件在 `modpack/mods`，同一份文件已复制到该实例自己的 `mods`；旧的 `1.21.6` 与 Mindcraft 文件夹未改动。

## 模组锁定

Jurassic Reborn `1.4.2`（Modrinth version `nDHOaIRe`）依赖 GeckoLib `4.9.3`（`Grwn5rUB`）和 Citadel `2.7.1`（`ZkgKf4xj`）。客户端另安装官方 JEI `19.51.0.418`（`ufHUqt9b`）；专用服无需 JEI。精确文件、URL 和 SHA-512 见 `manifest.json`。四份 JAR 都已实际校验。

2026-10-17 已用 HMCL 实际启动该实例：主菜单显示 6 个模组已加载，日志确认 JEI `19.51.0.418` 被发现并完成配置及资源加载。使用的是未修改的官方 JAR；其版本声明没有导致这次 NeoForge `21.1.262` 启动失败。

## 展示规则

在世界中执行一次：

```mcfunction
/gamerule dinosaurMetabolism false
/gamerule doDinoBreeding false
```

这两个规则分别停止能量/饮水消耗和繁殖；不要给恐龙使用 `NoAI:1b`，否则会失去行走和觅食 AI。`allowCarcass=true` 使普通伤害先转成尸体状态，但真正的长期展示仍建议使用召唤 NBT 的 `Invulnerable:1b,PersistenceRequired:1b`；这两个是 Minecraft 通用实体字段，保留 AI。模组本身没有“关闭逃逸/关闭方块破坏”的独立配置项。配置把低、中、高围栏的最低安全硬度设为 `0.0`，让坚实围墙被判为安全；仍应使用 Jurassic Reborn 高安全围栏和封闭顶棚，避免开门或跳跃逃逸。

## 实体 ID 与示例 NBT

可直接使用的 8 种成年体参数见 `entities.json`。`DinosaurAge` 使用各物种的真实 `maximumAge`（成年判定为年龄超过 75%）；`Energy` 和 `Water` 按成年生命值计算为满值，`DNAQuality=100`，`Genetics` 是 30 位合法 A/C/G/T 序列。构造时确实会先成年，但自定义 NBT 读取缺少 `DinosaurAge` 会变成 0，所以不要省略这些字段。

```text
jurassicreborn:tyrannosaurus
jurassicreborn:velociraptor
jurassicreborn:dilophosaurus
jurassicreborn:brachiosaurus
jurassicreborn:triceratops
jurassicreborn:stegosaurus
jurassicreborn:parasaurolophus
jurassicreborn:ankylosaurus
```

通用召唤骨架（替换 `<id>` 和坐标）：

```mcfunction
/summon jurassicreborn:<id> ~ ~ ~ {DinosaurAge:150000,Health:50.0f,IsMale:1b,DNAQuality:100,Genetics:"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",Energy:120000,Water:120000,DigestingFood:0,IsCarcass:0b,TicksUntilDeath:0,BreedCooldown:0,PregnantTime:0,Order:0b,Variant:0,Invulnerable:1b,PersistenceRequired:1b,NoAI:0b}
```

模组保存的自定义字段包括 `DinosaurAge`、`IsMale`、`BreedCooldown`、`PregnantTime`、`IsCarcass`、`TicksUntilDeath`、`Water`、`Energy`、`DigestingFood`；这些字段由模组读写，不能用来替代世界规则。`dinosaurMetabolism=false` 会停止代谢扣除，因此满值也不会继续减少；保持满值可避免 AI 在规则切换或配置失效时立刻进入饥渴状态。64 只展示时按围栏分区、保持区块加载，并给草食/肉食使用对应 feeder；`renderDistance=10`、`simulationDistance=5` 已写入 `instance/options.txt`。Java 21 和最大内存 6GB 是本机 HMCL 实例设置，不包含在模组安装脚本中。

## 围栏方块

实际注册 ID 包括 `jurassicreborn:low_security_fence_base`、`med_security_fence_base`、`high_security_fence_base`，以及对应的 `_mk2_base`、`_mk2_foundation`、`_wire`、`_mk2_wire`、`_pole`、`_mk2_pole`。推荐高安全 Mk II 基座、地基、立柱和电线完整连通；普通 `minecraft:iron_bars` 不是 JR 围栏类型，但其原版 destroy speed 为 5，高于已核对的霸王龙最大可破坏硬度 4、迅猛龙 2，逃逸 AI 的破坏检查会拒绝它。铁栏杆仍可能被跳跃或顶部缺口绕过，必须做足高度并封顶。`low/medium/highContainmentHardness=0.0` 只降低安全硬度门槛，仍需封顶、不断电并避免可开门缺口；智能逃逸 AI 仍会检查饥饿、脱水、孤独和卡住压力。

## 重新安装

在 PowerShell 执行 `modpack/install-jurassic-reborn.ps1`，脚本会复制 JAR 与配置并逐个验证 SHA-512。脚本只写入 `1.21.1-NeoForge` 独立运行目录。导出包不会复制 HMCL 的隐藏实例设置；在新电脑或新实例中还需选择 Java 21、关闭自动分配内存、将最大内存设为 6144 MB，并关闭客户端后重新启动，在 F3 核对最大内存。本机实例当前对应 `autoMemory=false`、`maxMemory=6144`。

安装包的 `instance/options.txt` 预设为简体中文（`lang:zh_cn`）。需要绕过 HMCL 做本地离线排查时，可用 `runtime/launch-client.ps1`；其 `-DryRun` 仅检查 Java、原生库、资源索引和依赖库，`-QuickPlayServer '127.0.0.1:25576'` 可直接连接本地服务器。
