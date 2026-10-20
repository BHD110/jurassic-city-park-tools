# 侏罗纪公园地图与建筑参考（2026-10-17）

这次搜索用于提炼空间关系、建筑比例和游览节奏。当前版本没有直接覆盖外部世界存档；正式地图仍使用本项目自己的方块计划和 Jurassic Reborn 生物。用户已明确允许个人使用版本加入外部建筑或地图资源，后续若导入 schematic，会先做版本转换、坐标裁剪和碰撞审计，并保留本项目自己的城市与轨道设计。

## 找到的参考

- Planet Minecraft 的 Jurassic / Jurassic Park / Jurassic World 地图索引：
  - https://www.planetminecraft.com/projects/tag/jurassic
  - https://www.planetminecraft.com/projects/tag/jurassicpark
  - https://www.planetminecraft.com/projects/tag/jurassicworld
  - 可观察到的共性：地图通常把围场、道路、游客中心和岛屿景观做成连续游览路线，而不是孤立建筑。
- Skunke 的 Isla Nublar 1993 地图展示：
  - https://www.youtube.com/watch?v=CoErpyt7Te8
  - 章节中明确出现游客中心、猛禽围场、维护棚、应急避难所、Boneshaker Coaster、观景点、湖泊和多个围场。对本项目的直接启发是把城市接驳、园区设施和刺激型轨道放进同一个闭环叙事。
- RichardCreations 的 Jurassic Park Map Tour：
  - https://www.youtube.com/watch?v=GWqnS7ngcTM
  - 展示了带地图导览、车辆游览和多个恐龙区域的完整公园；本项目借鉴“沿途持续有地标”的节奏，不照搬其存档。
- Minecraft Schematics 的 Jurassic Park Visitor Center：
  - https://www.minecraft-schematics.com/schematic/20076
  - 作为比例和立面细节参考；不直接导入，避免 schematic 的版本、依赖和授权问题。
- RomanRodri 的游客中心教程与 schematic 说明：
  - https://www.youtube.com/watch?v=gP5bj24Khvw
  - https://www.youtube.com/watch?v=kYGv2rTlivU
  - 参考要点：三段圆锥/穹顶轮廓、低矮混凝土翼楼、深色窗洞、入口台阶、屋顶排风/设备和前后连廊。
- Minecraft Wiki 的过山车建造说明：
  - https://minecraft.fandom.com/wiki/Tutorials/Building_a_rollercoaster
  - 参考要点：先做支撑和路线骨架，再放轨道与动力轨；坡段保持方向连续，给出足够净空。

## 转成当前地图的计划

1. **城市接轨**：新闭环不再只沿城市外圈绕行，增加一段穿过城市主街、车站广场和两条街区之间的高架/下穿段；城市建筑在轨道两侧预留净空和可见的站台、雨棚、广告牌。
2. **刺激型轨道**：加入长爬升、连续下降、峡谷桥、短隧道、低位急转和城市高架俯冲。每个坡段用静态脚本检查 `ascending_*` 方向、支撑方块、头顶两格净空和闭环连续性，实际运行再记录时长和一圈完成。
3. **城市差异**：在现有建筑地块内增加至少 24 个外立面变体，分为转角塔楼、带拱廊的公共楼、阳台公寓、屋顶水塔/钟楼、停车楼、市场雨棚和消防/交通设施。保持地面道路连通，避免回到整齐重复的火柴盒。
4. **景观关系**：轨道穿城段与公园入口、游客中心、中央溪流和围场观景台形成连续地标；uNmINeD 总图用于检查密度，静态 AABB 和区块/NBT 检查用于确认没有穿模或浮空。

### 新路线候选：Jurassic City Coaster v1

已按上面的参考方向生成一份只读施工补丁：[`map/generated/city-coaster-route.json`](../generated/city-coaster-route.json)，生成脚本为 [`map/city-coaster-route.mjs`](../city-coaster-route.mjs)。它不改写 `full.json`，施工时按“清旧轨道 -> 处理一道围栏闸口 -> 放支撑 -> 放轨道 -> 清头顶净空”的顺序执行。

- 路线闭环从城市中央车站 `(0,64,650)` 出发，先沿 `z=650` 的车站大道进入东侧街区，再沿 `x=780` 的城市服务道路南北穿行，最后沿 `z=-780` 的北侧道路穿过东西两片城市街区，回到公园边缘和车站。
- 公园段使用 `x=340`、`x=-350` 两条边线，避开八个围场；东侧下降段在 `z=-592` 的既有铁栏处开 7 格宽、11 格高的可追踪闸口，避免把围栏压进轨道净空。
- 轨道长 5,120 点，静态估算 640 秒；高度范围 Y=64..94，包含东侧高架、94 到 70 的长下降、湖岸低位冲刺、西侧爬升和回站下降。动力轨 2,555 段，支柱 262 组，头顶净空 3 格。
- 当前基于 `full.json`、旧 `route.json` 的检查结果：路线重复/断点 0，坡段方向和转弯错误 0，建筑占地冲突 0，围场冲突 0，既有实体方块冲突 0。这个结果只证明候选计划可施工，实际应用后仍需重新渲染总图和做服务端完整一圈测试。

## 验收标准

- 新路线闭合，穿过至少 3 个城市街区，并保留 8 个恐龙展示区的可见性。
- 最高点与最低点有明确落差，含至少 3 个爬升/下降段、1 个桥段和 1 个隧道段；轨道上方 2 格无障碍，动力轨供电正确。
- 城市变体至少 24 栋，`style` 和屋顶/立面特征不重复成一套模板；道路和建筑占地碰撞为 0。
- 施工后保存世界，重新渲染 uNmINeD 总图与中央/城市局部图，再做区块检查和完整轨道测试。
