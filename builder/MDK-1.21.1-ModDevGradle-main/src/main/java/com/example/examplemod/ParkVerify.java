package com.example.examplemod;

import com.google.gson.*;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import com.mojang.logging.LogUtils;
import net.minecraft.commands.arguments.blocks.BlockStateParser;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.block.state.BlockState;
import org.slf4j.Logger;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;

final class ParkVerify {
    private static final Logger LOGGER = LogUtils.getLogger();
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private final ServerLevel level;
    private final Path reportPath;
    private final List<Check> checks = new ArrayList<>();
    private final List<JsonObject> boxes = new ArrayList<>();
    private final JsonArray failures = new JsonArray();
    private final Map<String,int[]> counts = new LinkedHashMap<>();
    private final Map<String,BlockState> parsedStates = new HashMap<>();
    private int index;
    private int failed;
    private boolean running = true;

    private record Check(String category, BlockPos pos, String expected, boolean support) {}

    private ParkVerify(MinecraftServer server) throws IOException {
        level = server.overworld();
        reportPath = server.getFile("parkbuild-verify.json");
        Path generated = server.getFile("../../map/generated").normalize();
        JsonObject plan = JsonParser.parseString(Files.readString(generated.resolve("full.json"),StandardCharsets.UTF_8)).getAsJsonObject();
        collectBoxes(plan.getAsJsonArray("operations"));
        addBuildingChecks(plan.getAsJsonObject("metadata").getAsJsonArray("buildings"));
        addEnclosureChecks(plan.getAsJsonObject("metadata").getAsJsonArray("enclosures"));
        addGroundChecks();
        sampleBoxes("road", "minecraft:smooth_stone", 32);
        Path routeFile = generated.resolve("route.json");
        JsonArray route = JsonParser.parseString(Files.readString(routeFile,StandardCharsets.UTF_8)).getAsJsonObject().getAsJsonArray("points");
        for (JsonElement element : route) {
            JsonObject point = element.getAsJsonObject();
            int x=point.get("x").getAsInt(), y=point.get("y").getAsInt(), z=point.get("z").getAsInt();
            String id=point.get("powered").getAsBoolean()?"minecraft:powered_rail":"minecraft:rail";
            String shape=point.get("shape").getAsString();
            String state=id+"[shape="+shape+(point.get("powered").getAsBoolean()?",powered=true":"")+"]";
            checks.add(new Check("rail",new BlockPos(x,y,z),state,false));
            checks.add(new Check("rail_support",new BlockPos(x,y-1,z),"non_air",true));
            checks.add(new Check("rail_clearance",new BlockPos(x,y+1,z),"minecraft:air",false));
            checks.add(new Check("rail_clearance",new BlockPos(x,y+2,z),"minecraft:air",false));
        }
        if (checks.size()<20000) throw new IOException("verification target set is incomplete");
    }

    static ParkVerify start(MinecraftServer server) throws IOException { return new ParkVerify(server); }
    boolean running() { return running; }
    String summary() { return "verify="+(running?"running":"done")+" checked="+index+"/"+checks.size()+" failed="+failed; }

    private void collectBoxes(JsonArray operations) {
        for (JsonElement element:operations) {
            JsonObject op=element.getAsJsonObject();
            if (op.has("kind") && op.get("kind").getAsString().equals("box")) boxes.add(op);
        }
    }

    private void addBuildingChecks(JsonArray buildings) throws IOException {
        if (buildings == null || buildings.size() < 80) throw new IOException("building metadata is incomplete");
        for (JsonElement element : buildings) {
            JsonObject building = element.getAsJsonObject();
            JsonObject targets = building.has("verify") ? building.getAsJsonObject("verify") : null;
            if (targets == null || !targets.has("roof") || !targets.has("wall"))
                throw new IOException("missing roof/wall targets for " + building.get("id").getAsString());
            addTarget("roof", targets.getAsJsonObject("roof"));
            addTarget("wall", targets.getAsJsonObject("wall"));
        }
    }

    private void addTarget(String category, JsonObject target) {
        BlockPos pos = new BlockPos(target.get("x").getAsInt(),target.get("y").getAsInt(),target.get("z").getAsInt());
        checks.add(new Check(category,pos,target.get("block").getAsString(),false));
    }

    private void addEnclosureChecks(JsonArray enclosures) throws IOException {
        if (enclosures == null || enclosures.size() != 8) throw new IOException("expected eight enclosures");
        for (JsonElement element : enclosures) {
            JsonObject b = element.getAsJsonObject().getAsJsonObject("bounds");
            int x1=b.get("x1").getAsInt(), x2=b.get("x2").getAsInt();
            int z1=b.get("z1").getAsInt(), z2=b.get("z2").getAsInt();
            for (int y=64;y<=73;y++) {
                for (int x=x1;x<=x2;x++) {
                    checks.add(new Check("enclosure",new BlockPos(x,y,z1),"enclosure_wall",false));
                    checks.add(new Check("enclosure",new BlockPos(x,y,z2),"enclosure_wall",false));
                }
                for (int z=z1+1;z<z2;z++) {
                    checks.add(new Check("enclosure",new BlockPos(x1,y,z),"enclosure_wall",false));
                    checks.add(new Check("enclosure",new BlockPos(x2,y,z),"enclosure_wall",false));
                }
            }
        }
    }

    private void addGroundChecks() throws IOException {
        int found=0;
        for (int x : new int[]{-750,-500,-250,0,250,500,750}) {
            for (int z : new int[]{-750,-500,-250,0,250,500,750}) {
                BlockPos pos = new BlockPos(x,63,z);
                if (lastBoxState(pos)==null) {
                    checks.add(new Check("ground",pos,"minecraft:grass_block",false));
                    found++;
                }
            }
        }
        if (found<8) throw new IOException("too few unmodified ground targets");
    }

    private void sampleBoxes(String category, String blockPrefix, int required) {
        List<JsonObject> candidates=new ArrayList<>();
        for (JsonObject box:boxes) if (box.get("block").getAsString().startsWith(blockPrefix)) candidates.add(box);
        int count=Math.min(required,candidates.size());
        for (int i=0;i<count;i++) {
            JsonObject box=candidates.get((int)((long)i*candidates.size()/count));
            int x=(box.get("x1").getAsInt()+box.get("x2").getAsInt())/2;
            int y=(box.get("y1").getAsInt()+box.get("y2").getAsInt())/2;
            int z=(box.get("z1").getAsInt()+box.get("z2").getAsInt())/2;
            checks.add(new Check(category,new BlockPos(x,y,z),null,false));
        }
    }

    void tick() {
        if (!running) return;
        for (int n=0;n<64 && index<checks.size();n++,index++) check(checks.get(index));
        if (index>=checks.size()) finish();
    }

    private void check(Check check) {
        String expected=check.expected();
        if (expected==null) expected=lastBoxState(check.pos());
        BlockState actual=level.getBlockState(check.pos());
        boolean matches;
        if (check.support()) matches=!actual.isAir();
        else if (check.category().equals("enclosure")) {
            String id=BuiltInRegistries.BLOCK.getKey(actual.getBlock()).toString();
            matches=id.equals("minecraft:reinforced_deepslate") || id.equals("minecraft:polished_andesite") || id.equals("minecraft:iron_bars");
        }
        else if (expected==null) matches=false;
        else {
            try {
                BlockState expectedState=parsedStates.computeIfAbsent(expected,this::parse);
                matches=check.category().equals("fence")
                    ? actual.getBlock()==expectedState.getBlock()
                    : actual.equals(expectedState);
            }
            catch (RuntimeException ex) { matches=false; }
        }
        int[] count=counts.computeIfAbsent(check.category(),key->new int[2]);
        count[0]++;
        if (!matches) {
            count[1]++;
            failed++;
            if (failures.size()<200) {
                JsonObject failure=new JsonObject();
                failure.addProperty("category",check.category());
                failure.addProperty("x",check.pos().getX()); failure.addProperty("y",check.pos().getY()); failure.addProperty("z",check.pos().getZ());
                failure.addProperty("expected",expected==null?"unknown":expected);
                failure.addProperty("actual",BlockStateParser.serialize(actual));
                failures.add(failure);
            }
        }
    }

    private BlockState parse(String text) {
        try { return BlockStateParser.parseForBlock(BuiltInRegistries.BLOCK.asLookup(),text,false).blockState(); }
        catch (CommandSyntaxException ex) { throw new IllegalArgumentException(ex); }
    }

    private String lastBoxState(BlockPos pos) {
        for (int i=boxes.size()-1;i>=0;i--) {
            JsonObject box=boxes.get(i);
            int x=pos.getX(),y=pos.getY(),z=pos.getZ();
            if (x>=Math.min(box.get("x1").getAsInt(),box.get("x2").getAsInt()) && x<=Math.max(box.get("x1").getAsInt(),box.get("x2").getAsInt())
                && y>=Math.min(box.get("y1").getAsInt(),box.get("y2").getAsInt()) && y<=Math.max(box.get("y1").getAsInt(),box.get("y2").getAsInt())
                && z>=Math.min(box.get("z1").getAsInt(),box.get("z2").getAsInt()) && z<=Math.max(box.get("z1").getAsInt(),box.get("z2").getAsInt())) return box.get("block").getAsString();
        }
        return null;
    }

    private void finish() {
        running=false;
        JsonObject report=new JsonObject();
        report.addProperty("verifiedAt",Instant.now().toString());
        report.addProperty("checked",index);
        report.addProperty("failed",failed);
        JsonObject categories=new JsonObject();
        for (Map.Entry<String,int[]> entry:counts.entrySet()) {
            JsonObject count=new JsonObject();
            count.addProperty("checked",entry.getValue()[0]);
            count.addProperty("failed",entry.getValue()[1]);
            categories.add(entry.getKey(),count);
        }
        report.add("categories",categories);
        report.add("failures",failures);
        try { Files.writeString(reportPath,GSON.toJson(report),StandardCharsets.UTF_8); }
        catch (IOException ex) { LOGGER.error("Could not write verification report",ex); }
        LOGGER.info("Park verification checked {} positions, {} failed",index,failed);
    }
}
