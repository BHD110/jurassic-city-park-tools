# Jurassic City Park 建造复现

这是制作存档时用的专用服流程。最终游玩只需要导出的世界和 `modpack`；`parkbuilder-1.0.0.jar` 是临时施工工具，不放进交付给玩家的 `mods`。

## 环境

- Minecraft 1.21.1，NeoForge 21.1.262，Java 21。
- 在空的服务端目录运行 `java -jar neoforge-21.1.262-installer.jar --installServer`，阅读并接受 EULA，再把 `modpack/mods` 中的 `jurassicreborn-1.4.2.jar`、`geckolib-neoforge-1.21.1-4.9.3.jar`、`citadel-2.7.1-1.21.1.jar` 放入服务端 `mods`。JEI 只装客户端。
- 把 `builder` 源码用 Java 21 构建（`gradlew.bat build`），将生成的 `parkbuilder-1.0.0.jar` 暂时放入服务端 `mods`。
- 服务端工作目录必须位于项目的 `runtime/server`，因为建造模组从相对路径读取 `../../map/generated/*.json`。
- 如从交付包复建，在项目根目录运行 `npm install` 安装 `package.json` 指定版本的 `prismarine-nbt`；导出时准备单人存档的 `runtime/prepare-world.mjs` 需要它。

新建世界前设置 `server.properties`。下面是不会包含口令的关键项；`generator-settings` 的冒号转义是 Java properties 文件格式的一部分：

```properties
level-name=jurassic-city-v2
level-type=minecraft\:flat
generator-settings={"biome"\:"minecraft\:plains","layers"\:[{"block"\:"minecraft\:bedrock","height"\:1},{"block"\:"minecraft\:stone","height"\:123},{"block"\:"minecraft\:dirt","height"\:3},{"block"\:"minecraft\:grass_block","height"\:1}],"features"\:false,"lakes"\:false}
generate-structures=false
gamemode=creative
enable-command-block=true
server-ip=127.0.0.1
server-port=25576
online-mode=false
enforce-secure-profile=false
```

这组地层从 y=-64 开始，草地正好在 y=63，泥土在 y=60-62。`level-name` 必须指向一个尚不存在的目录，改已有世界的生成配置不会修正已经生成的区块。这里的离线登录配置只适合绑定 `127.0.0.1` 的本机专用服；不要开放到局域网或公网。RCON 口令自行在本机配置，不能随存档或说明文件打包。

## 建造与验收

在服务端目录用 `run.bat nogui` 启动，看到 `Done` 后通过服务端控制台或本机 RCON 依次执行：

```text
execute if block 0 63 0 minecraft:grass_block
execute if block 0 62 0 minecraft:dirt
execute if block 0 64 0 minecraft:air
parkbuild validate full
parkbuild start full
parkbuild status
```

开工前还要检查 `parkbuild-validate-full.json` 的 `invalid=0`，并确认报告中的计划 SHA256 对应当前 `map/generated/full.json`。预览时可把 `full` 换成 `preview`；预览通过后再运行全图。建造中断后使用 `parkbuild resume` 继续已保存的 `parkbuild-state.json`，不要再次 `start full` 从头覆盖。

`final-fixes` 是带 `removeEntities` 和 `spawn` 的一次性修补计划，不能在已有恐龙的世界里盲目重复执行，否则可能生成重复个体。执行前先正常停服、备份世界，并用 `node verification/check-save.mjs runtime/server/jurassic-city-v2` 核对现有实体；需要清理历史恐龙时，在停服状态下运行 `node verification/prune-jurassic-entities.mjs runtime/server/jurassic-city-v2`。清理后用 `check-save.mjs` 确认恐龙数量为 0（此时因计划要求 64 只，脚本会报告数量不符），再启动服务运行一次 `parkbuild start final-fixes`。其移除步骤会等待实体区块完成加载，加载超时会停止施工；遇到失败先检查世界和报告，不要直接重试生成步骤。完成后 `save-all flush`，停服并再次运行 `check-save.mjs` 核对 64 只恐龙。

全图完成后执行以下命令，检查 `parkbuild-verify.json` 各类失败数为 0，并等待矿车带乘客自然跑完至少 6000 tick、300 秒和一整圈：

```text
parkbuild verify
parkbuild verifyStatus
parkbuild railtest start
parkbuild railtest status
save-all flush
stop
```

`parkbuild-railtest.json` 记录世界名、计划与路线 SHA256、矿车和乘客 UUID、轨迹与用时；改过计划或路线后必须重测。停服后用 `runtime/export-world.ps1` 导出并安装到客户端，核对保存后重新进入的恐龙数量和建筑。正式游玩时恢复 `max-tick-time=60000`，停止施工服务端并从玩家模组目录移除 ParkBuilder；只保留 Jurassic Reborn、GeckoLib、Citadel（客户端可另有 JEI）。不要打包服务端 `server.properties`，其中可能含 RCON 口令。
