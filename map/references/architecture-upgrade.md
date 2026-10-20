# 1993 公园与热带城市建筑参考（2026-10-17）

本页保留建筑重建初始调研时的外观依据与下载状态；**初始调研阶段导入数为 0，当前已施工 4 份外部素材**，以 [asset-manifest.json](assets/asset-manifest.json) 为准。下载受阻的页面只算参考，不能算已采用建筑。这里的城市是本地图原创的热带门户城市，不声称是电影中的努布拉岛城市。

| 来源 | 已核对的图片与建筑特征 | 可下载状态 / 用法 |
| --- | --- | --- |
| [1993 电影游客中心外景](https://artdepartmental.com/blog/jurassic-park-production-design)，本地图片 [1993-visitor-center.jpg](1993-visitor-center.jpg) | 已实际看图。三座不等高的茅草锥顶；中央锥顶最大，左右是较小锥顶；低矮灰色混凝土翼楼有弧形端部、深色连续窗带；入口台阶、种植槽、临水道路清楚可见。建议主楼做宽而低的横向体量，中央屋顶高于两翼，入口居中。 | 电影外观参考，没有 schematic。应以这张图校正园区主楼轮廓。 |
| [1993 主门参考](https://jurassicpark.fandom.com/wiki/Park_Gate)，本地图片 [1993-main-gate.jpg](1993-main-gate.jpg) | 双侧厚重立柱、深木色门扇、红黄字牌和火炬；门前道路收窄，后方被茂密植被遮挡。适合作为入口的近景标志，不能只做平面牌坊。 | 电影外观参考，没有 schematic。 |
| [JPOG Entrance Visitor Center Schematic](https://www.planetminecraft.com/project/jpog-entrace-visitor-center-schematic/) | 页面有建筑截图、作者说明可以下载后在世界中修改。展示的是游戏 JPOG 风格游客中心，不等同于 1993 电影游客中心；页面最前面的图片是原游戏截图，不能误当 Minecraft 成品。可借鉴入口前场、圆锥草顶和棕榈树密度。 | 初始调研时尚未取得；后续已下载、裁剪并替换原游客中心，详见 [素材清单](assets/asset-manifest.json)。 |
| [Miami Mansion，Minecraft Schematics #30375](https://www.minecraft-schematics.com/schematic/30375/)；[大图](https://cdn.minecraft-schematics.com/pictures/30375/large-picture-30375.png?time=1782072507) | 已实际看大图。两层展开式住宅，白色外墙、赤陶色多坡屋顶、分段山墙、浅色柱廊、阳台、宽窗和棕榈树。适合城市外围的旅馆、行政别墅或度假住宅；体量应缩成街区地块，避免一整片城市都变成豪宅。 | 页面列有 Download，但下载端点本轮返回 Cloudflare 403；**没有取得 schematic**。图片和页面可用于自行建造。 |

## 给建筑施工的具体取舍

- 园区主楼优先保留电影外景的三锥顶、低翼楼、灰墙黑窗和台阶，别把 JPOG 方案直接盖成 1993 主楼。
- 城市按功能混合：白墙红瓦的旅馆与住宅可用 Miami Mansion 作轮廓参考；其余要有商铺、市场、车站、服务楼和不同层数的街屋。每栋的屋顶线、窗节奏、首层入口和阳台至少有一项明显不同。
- 这些参考只处理外观。原任务的多种活动恐龙、1993 公园、较大城市、至少五分钟且穿城并有起伏的过山车，仍需保留。最终用文件/地图工具和静态检查验收，不用游戏画面。

## 下载核对

初始调研阶段没有向 `map/references/assets/` 放入未经验证的下载。旧资料中的 [Minecraft Schematics #20076](https://www.minecraft-schematics.com/schematic/20076/) 当时返回 404，不应作为可用素材。Miami Mansion 下载端点返回 403，至今未集成；JPOG 后续已取得并导入，见 [素材清单](assets/asset-manifest.json)。

## 实际取得的外部素材（本页后续更新）

- [Ocean House with Full Interior](https://abfielder.com/Products/ProductDetails.php?id=3079)，作者 ooKrazy8oo：已取得 [Sponge .schem](assets/ocean-house-ookrazy8oo.schem)、[.litematic](assets/ocean-house-ookrazy8oo.litematic) 和 [预览图](assets/ocean-house-preview.jpg)。图中灰色深檐屋顶、木质阳台、临水桩基和栈桥，现已作为湖岸房屋导入；它**不是**游客中心主楼。
- `.schem` 已用 NBT 解析：29×18×14，Sponge v2，DataVersion 3955（Minecraft 1.21），原点 Offset 0；140 个 palette 状态均为原版方块；实体 0，命令方块、结构方块、拼图方块和刷怪笼 0。40 个普通方块实体含箱子、标牌等，施工建议只复制方块状态，不复制这些 NBT。文件哈希、来源和下载失败记录见 [asset-manifest.json](assets/asset-manifest.json)。
- [Mediterranean Style Home](https://abfielder.com/Products/ProductDetails.php?id=2425) 的黄墙、红砖多坡顶、竖向窗和藤蔓已用于替换 `city-06`；[Fisherman House](https://abfielder.com/Products/ProductDetails.php?id=11656) 的蓝绿立面和水边平台已作为湖岸房屋导入。两者初始调研时仅看过预览图，后续取得文件并导入的记录见 [素材清单](assets/asset-manifest.json)。
