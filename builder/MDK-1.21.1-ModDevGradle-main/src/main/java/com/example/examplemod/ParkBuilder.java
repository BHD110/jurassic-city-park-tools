package com.example.examplemod;

import com.google.gson.*;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import com.mojang.logging.LogUtils;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.CommandResultCallback;
import net.minecraft.commands.Commands;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.commands.arguments.blocks.BlockStateParser;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.TagParser;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.entity.SignBlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.chunk.status.ChunkStatus;
import net.minecraft.world.phys.AABB;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.server.ServerStoppingEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import org.slf4j.Logger;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

@Mod(ParkBuilder.MODID)
public final class ParkBuilder {
    public static final String MODID = "parkbuilder";
    private static final Logger LOGGER = LogUtils.getLogger();
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final int BLOCKS_PER_TICK = 256;
    private static final int ENTITY_LOAD_TIMEOUT_TICKS = 200;
    private BuildJob job;
    private RailTest railTest;
    private ParkVerify verifier;
    private int ticksSinceSave;
    private long lastSaveAtMs;

    public ParkBuilder() {
        net.neoforged.neoforge.common.NeoForge.EVENT_BUS.register(this);
        net.neoforged.neoforge.common.NeoForge.EVENT_BUS.register(new DinosaurAudio());
    }

    @SubscribeEvent
    public void commands(RegisterCommandsEvent e) {
        CommandDispatcher<CommandSourceStack> d = e.getDispatcher();
        d.register(Commands.literal("parkbuild").requires(s -> s.hasPermission(2))
            .then(Commands.literal("start").then(Commands.argument("name", StringArgumentType.word())
                .executes(c -> start(c.getSource(), StringArgumentType.getString(c, "name")))))
            .then(Commands.literal("status").executes(c -> status(c.getSource())))
            .then(Commands.literal("resume").executes(c -> resume(c.getSource())))
            .then(Commands.literal("cancel").executes(c -> cancel(c.getSource())))
            .then(Commands.literal("audit").executes(c -> audit(c.getSource())))
            .then(Commands.literal("validate").then(Commands.argument("name", StringArgumentType.word())
                .executes(c -> validate(c.getSource(), StringArgumentType.getString(c, "name")))))
            .then(Commands.literal("verify").executes(c -> verify(c.getSource())))
            .then(Commands.literal("verifyStatus").executes(c -> verifyStatus(c.getSource())))
            .then(Commands.literal("finalize").executes(c -> finalizeWorld(c.getSource())))
            .then(Commands.literal("railtest")
                .then(Commands.literal("start").executes(c -> railStart(c.getSource()))
                    .then(Commands.argument("name", StringArgumentType.word())
                        .executes(c -> railStart(c.getSource(), StringArgumentType.getString(c, "name")))))
                .then(Commands.literal("status").executes(c -> railStatus(c.getSource())))
                .then(Commands.literal("stop").executes(c -> railStop(c.getSource()))))
            .then(Commands.literal("tp").then(Commands.argument("x", com.mojang.brigadier.arguments.DoubleArgumentType.doubleArg())
                .then(Commands.argument("y", com.mojang.brigadier.arguments.DoubleArgumentType.doubleArg())
                .then(Commands.argument("z", com.mojang.brigadier.arguments.DoubleArgumentType.doubleArg())
                    .executes(c -> tp(c)))))));
    }

    private int start(CommandSourceStack source, String name) {
        if (job != null && !job.done) { source.sendFailure(net.minecraft.network.chat.Component.literal("build already running")); return 0; }
        MinecraftServer server = source.getServer();
        if (!name.matches("[a-zA-Z0-9_-]{1,64}")) { source.sendFailure(net.minecraft.network.chat.Component.literal("invalid generated plan name")); return 0; }
        Path file = server.getFile("../../map/generated/" + name + ".json").normalize();
        Path state = server.getFile("parkbuild-state.json");
        try {
            ParkValidate.Result validation = ParkValidate.run(server, name);
            if (validation.invalid() > 0) {
                source.sendFailure(net.minecraft.network.chat.Component.literal(validation.summary()));
                return 0;
            }
            job = BuildJob.read(file); job.file = file; job.stateFile = state; job.save();
            source.sendSuccess(() -> net.minecraft.network.chat.Component.literal("started " + file), true);
            return 1;
        }
        catch (Exception ex) { LOGGER.error("Cannot read build file", ex); source.sendFailure(net.minecraft.network.chat.Component.literal("cannot read " + file + ": " + ex.getMessage())); return 0; }
    }
    private int resume(CommandSourceStack s) { try { if (job == null) job=BuildJob.resume(s.getServer().getFile("parkbuild-state.json")); job.done=false; job.cancelled=false; job.save(); s.sendSuccess(() -> net.minecraft.network.chat.Component.literal("resumed " + job.summary()), true); return 1; } catch(Exception ex) { s.sendFailure(net.minecraft.network.chat.Component.literal("no saved job: "+ex.getMessage())); return 0; } }
    private int cancel(CommandSourceStack s) { if (job == null) return 0; job.done=true; job.cancelled=true; job.save(); s.sendSuccess(() -> net.minecraft.network.chat.Component.literal("cancelled"), true); return 1; }
    private int status(CommandSourceStack s) { if (job == null) { s.sendSuccess(() -> net.minecraft.network.chat.Component.literal("idle"), false); return 1; } s.sendSuccess(() -> net.minecraft.network.chat.Component.literal(job.summary()), false); return 1; }
    private int audit(CommandSourceStack s) { if (job == null) return 0; s.sendSuccess(() -> net.minecraft.network.chat.Component.literal(job.summary() + " file=" + job.file), false); return 1; }
    private int validate(CommandSourceStack s, String name) {
        if (!name.matches("[a-zA-Z0-9_-]{1,64}")) { s.sendFailure(net.minecraft.network.chat.Component.literal("invalid generated plan name")); return 0; }
        try {
            ParkValidate.Result result = ParkValidate.run(s.getServer(), name);
            s.sendSuccess(() -> net.minecraft.network.chat.Component.literal(result.summary()), false);
            return result.invalid() == 0 ? 1 : 0;
        } catch (Exception ex) {
            LOGGER.error("Plan validation failed", ex);
            s.sendFailure(net.minecraft.network.chat.Component.literal("validation failed: " + ex.getMessage()));
            return 0;
        }
    }
    private int railStart(CommandSourceStack s) { return railStart(s, null); }
    private int railStart(CommandSourceStack s, String name) {
        if (railTest != null && railTest.running()) { s.sendFailure(net.minecraft.network.chat.Component.literal("rail test already running")); return 0; }
        if (name != null && !name.matches("[a-zA-Z0-9_-]{1,64}")) { s.sendFailure(net.minecraft.network.chat.Component.literal("invalid generated plan name")); return 0; }
        try {
            railTest = RailTest.start(s.getServer(), name);
            s.sendSuccess(() -> net.minecraft.network.chat.Component.literal(railTest.summary()), true);
            return 1;
        } catch (Exception ex) {
            LOGGER.error("Rail test could not start", ex);
            s.sendFailure(net.minecraft.network.chat.Component.literal("rail test could not start: " + ex.getMessage()));
            return 0;
        }
    }
    private int railStatus(CommandSourceStack s) { s.sendSuccess(() -> net.minecraft.network.chat.Component.literal(railTest == null ? "rail test idle" : railTest.summary()), false); return 1; }
    private int railStop(CommandSourceStack s) { if (railTest == null || !railTest.running()) return 0; railTest.stop(s.getServer(), "stopped by operator"); s.sendSuccess(() -> net.minecraft.network.chat.Component.literal(railTest.summary()), true); return 1; }
    private int verify(CommandSourceStack s) {
        if (verifier != null && verifier.running()) { s.sendFailure(net.minecraft.network.chat.Component.literal("verification already running")); return 0; }
        try { verifier = ParkVerify.start(s.getServer()); s.sendSuccess(() -> net.minecraft.network.chat.Component.literal(verifier.summary()), true); return 1; }
        catch (Exception ex) { LOGGER.error("Verification could not start", ex); s.sendFailure(net.minecraft.network.chat.Component.literal("verification could not start: " + ex.getMessage())); return 0; }
    }
    private int verifyStatus(CommandSourceStack s) { s.sendSuccess(() -> net.minecraft.network.chat.Component.literal(verifier == null ? "verification idle" : verifier.summary()), false); return 1; }
    private int finalizeWorld(CommandSourceStack s) {
        s.getServer().setDefaultGameType(GameType.CREATIVE);
        s.getServer().saveEverything(false, true, true);
        s.sendSuccess(() -> net.minecraft.network.chat.Component.literal("default game mode set to creative; level name and allowCommands require offline level.dat update"), true);
        return 1;
    }
    private int tp(CommandContext<CommandSourceStack> c) throws CommandSyntaxException { ServerPlayer p=c.getSource().getPlayerOrException(); p.teleportTo(com.mojang.brigadier.arguments.DoubleArgumentType.getDouble(c,"x"),com.mojang.brigadier.arguments.DoubleArgumentType.getDouble(c,"y"),com.mojang.brigadier.arguments.DoubleArgumentType.getDouble(c,"z")); return 1; }

    @SubscribeEvent
    public void tick(ServerTickEvent.Post e) {
        if (job != null && !job.done && !job.cancelled) {
            try {
                job.step(e.getServer(), BLOCKS_PER_TICK);
                ticksSinceSave++;
                long now = System.currentTimeMillis();
                if (ticksSinceSave >= 100 || now - lastSaveAtMs >= 5000) {
                    job.save();
                    ticksSinceSave = 0;
                    lastSaveAtMs = now;
                }
            } catch (Exception ex) {
                LOGGER.error("Build tick failed", ex);
                job.error = ex.toString();
                job.done = true;
                job.save();
            }
        }
        if (railTest != null && railTest.running()) railTest.tick(e.getServer());
        if (verifier != null && verifier.running()) verifier.tick();
    }

    @SubscribeEvent
    public void stopping(ServerStoppingEvent e) {
        if (job != null && !job.done) job.save();
        if (railTest != null && railTest.running()) railTest.stop(e.getServer(), "server stopping");
    }

    private static final class BuildJob {
        String name; JsonObject bounds; JsonArray operations; int opIndex; long placed; boolean done, cancelled; String error=""; transient Path file, stateFile;
        static BuildJob read(Path p) throws IOException { BuildJob j=new BuildJob(); JsonObject root=JsonParser.parseString(Files.readString(p, StandardCharsets.UTF_8)).getAsJsonObject(); j.name=root.get("name").getAsString(); j.bounds=root.getAsJsonObject("bounds"); j.operations=root.getAsJsonArray("operations"); return j; }
        static BuildJob resume(Path p) throws IOException { BuildJob j=new BuildJob(); JsonObject root=JsonParser.parseString(Files.readString(p,StandardCharsets.UTF_8)).getAsJsonObject(); j.name=root.get("name").getAsString(); j.bounds=root.getAsJsonObject("bounds"); j.operations=root.getAsJsonArray("operations"); j.opIndex=root.get("opIndex").getAsInt(); j.placed=root.get("placed").getAsLong(); j.done=root.get("done").getAsBoolean(); j.cancelled=root.get("cancelled").getAsBoolean(); j.error=root.get("error").getAsString(); j.file=Path.of(root.get("source").getAsString()); j.stateFile=p; return j; }
        void step(MinecraftServer server, int budget) throws Exception { ServerLevel level=server.overworld(); while (budget>0 && opIndex<operations.size()) { JsonObject op=operations.get(opIndex).getAsJsonObject(); String k=op.get("kind").getAsString(); int used=0; if (k.equals("box")) used=box(level,op,budget); else if (k.equals("command")) { server.getCommands().performPrefixedCommand(server.createCommandSourceStack().withSuppressedOutput(), op.get("command").getAsString()); used=1; } else if (k.equals("spawn")) { spawn(level,op); used=1; } else if (k.equals("sign")) { sign(level,op); used=1; } else if (k.equals("removeEntities")) used=removeEntities(level,op); else used=1; if (used==0) break; budget-=used; if ((k.equals("box") && !boxFinished(op)) || (k.equals("removeEntities") && !removeFinished(op))) break; opIndex++; } if (opIndex>=operations.size()) { done=true; save(); LOGGER.info("Park build complete: {} blocks", placed); } }
        int box(ServerLevel level, JsonObject op, int budget) throws CommandSyntaxException {
            int x1 = op.get("x1").getAsInt(), x2 = op.get("x2").getAsInt();
            int y1 = op.get("y1").getAsInt(), y2 = op.get("y2").getAsInt();
            int z1 = op.get("z1").getAsInt(), z2 = op.get("z2").getAsInt();
            int xLen = Math.abs(x2 - x1) + 1, yLen = Math.abs(y2 - y1) + 1;
            int zLen = Math.abs(z2 - z1) + 1;
            long plane = (long) xLen * yLen, volume = plane * zLen;
            long offset = boxOffset(op), start = offset;
            String block = op.get("block").getAsString();
            String replace = op.has("replace") ? op.get("replace").getAsString() : null;

            if (plane <= 32768 && !op.has("_fillFailed")) {
                int firstZ = (int) (offset / plane);
                int lastZ = Math.min(zLen - 1, firstZ + Math.max(1, (int) (32768 / plane)) - 1);
                int direction = Integer.compare(z2, z1);
                int fillZ1 = z1 + firstZ * direction;
                int fillZ2 = z1 + lastZ * direction;
                if (fill(level, x1, y1, fillZ1, x2, y2, fillZ2, block, replace)) {
                    long nextOffset = Math.min(volume, (long) (lastZ + 1) * plane);
                    op.addProperty("_offset", nextOffset);
                    placed += Math.max(0, nextOffset - offset);
                    return 1;
                }
                op.addProperty("_fillFailed", true);
                LOGGER.warn("fill failed at operation {}, falling back to individual blocks", opIndex);
            }

            BlockState state = parseBlock(block);
            BlockState replaceState = replace == null ? null : parseBlock(replace);
            for (int count = 0; count < budget && offset < volume; count++, offset++) {
                int dx = (int) (offset % xLen);
                int dy = (int) ((offset / xLen) % yLen);
                int dz = (int) (offset / plane);
                BlockPos pos = new BlockPos(Math.min(x1, x2) + dx, Math.min(y1, y2) + dy, Math.min(z1, z2) + dz);
                if (replaceState == null || matchesReplace(level.getBlockState(pos), replaceState, replace)) level.setBlock(pos, state, 3);
                placed++;
            }
            op.addProperty("_offset", offset);
            return (int) (offset - start);
        }

        boolean fill(ServerLevel level, int x1, int y1, int z1, int x2, int y2, int z2, String block, String replace) {
            int minCx = Math.min(x1, x2) >> 4, maxCx = Math.max(x1, x2) >> 4;
            int minCz = Math.min(z1, z2) >> 4, maxCz = Math.max(z1, z2) >> 4;
            for (int cx = minCx; cx <= maxCx; cx++) {
                for (int cz = minCz; cz <= maxCz; cz++) {
                    level.getChunkSource().getChunk(cx, cz, ChunkStatus.FULL, true);
                }
            }
            String command = "fill " + x1 + " " + y1 + " " + z1 + " " + x2 + " " + y2 + " " + z2 + " " + block + " replace" + (replace == null ? "" : " " + replace);
            AtomicInteger result = new AtomicInteger(-1);
            CommandSourceStack source = level.getServer().createCommandSourceStack().withPermission(4)
                .withSuppressedOutput().withCallback((success, value) -> result.set(success ? value : 0));
            level.getServer().getCommands().performPrefixedCommand(source, command);
            if (result.get() > 0) return true;
            try {
                BlockState expected = parseBlock(block);
                BlockState replaceState = replace == null ? null : parseBlock(replace);
                for (int x=Math.min(x1,x2); x<=Math.max(x1,x2); x++) {
                    for (int y=Math.min(y1,y2); y<=Math.max(y1,y2); y++) {
                        for (int z=Math.min(z1,z2); z<=Math.max(z1,z2); z++) {
                            BlockState actual = level.getBlockState(new BlockPos(x,y,z));
                            if (replaceState == null ? !actual.equals(expected) : matchesReplace(actual,replaceState,replace)) return false;
                        }
                    }
                }
                return true;
            } catch (CommandSyntaxException ex) {
                return false;
            }
        }

        boolean matchesReplace(BlockState actual, BlockState filter, String text) {
            return text.contains("[") ? actual.equals(filter) : actual.getBlock() == filter.getBlock();
        }

        int removeEntities(ServerLevel level, JsonObject op) {
            JsonObject region = op.getAsJsonObject("region");
            int x1=Math.min(region.get("x1").getAsInt(),region.get("x2").getAsInt());
            int x2=Math.max(region.get("x1").getAsInt(),region.get("x2").getAsInt());
            int z1=Math.min(region.get("z1").getAsInt(),region.get("z2").getAsInt());
            int z2=Math.max(region.get("z1").getAsInt(),region.get("z2").getAsInt());
            int minCx=x1>>4,maxCx=x2>>4,minCz=z1>>4,maxCz=z2>>4;
            int width=maxCx-minCx+1, total=width*(maxCz-minCz+1);
            int index=op.has("_chunkIndex")?op.get("_chunkIndex").getAsInt():0;
            int cx=minCx+index%width, cz=minCz+index/width;
            long now=level.getServer().getTickCount();
            if (!op.has("_loadedTick")) {
                level.setChunkForced(cx,cz,true);
                level.getChunkSource().getChunk(cx,cz,ChunkStatus.FULL,true);
                op.addProperty("_loadedTick",now);
                return 0;
            }
            long loadedTick=op.get("_loadedTick").getAsLong();
            if (now<loadedTick) {
                level.setChunkForced(cx,cz,false);
                op.remove("_loadedTick");
                return 0;
            }
            if (!level.areEntitiesLoaded(ChunkPos.asLong(cx,cz))) {
                if (now-loadedTick>ENTITY_LOAD_TIMEOUT_TICKS) {
                    level.setChunkForced(cx,cz,false);
                    throw new IllegalStateException("entity chunk did not load at " + cx + "," + cz);
                }
                return 0;
            }
            AABB bounds=new AABB(cx*16,level.getMinBuildHeight(),cz*16,cx*16+16,level.getMaxBuildHeight(),cz*16+16);
            String tag=op.has("tag")?op.get("tag").getAsString():"";
            String entity=op.has("entity")?op.get("entity").getAsString():"";
            List<Entity> matches=level.getEntities((Entity)null,bounds,e->{
                if (!tag.isEmpty() && !e.getTags().contains(tag)) return false;
                ResourceLocation id=BuiltInRegistries.ENTITY_TYPE.getKey(e.getType());
                return entity.isEmpty() || (entity.contains(":")?id.toString().equals(entity):id.getNamespace().equals(entity));
            });
            matches.forEach(Entity::discard);
            int removed=op.has("_removed")?op.get("_removed").getAsInt():0;
            op.addProperty("_removed",removed+matches.size());
            level.setChunkForced(cx,cz,false);
            op.remove("_loadedTick");
            op.addProperty("_chunkIndex",index+1);
            if (index+1==total) LOGGER.info("removeEntities completed: {} removed in {} chunks",removed+matches.size(),total);
            return 1;
        }

        boolean removeFinished(JsonObject op) {
            JsonObject region=op.getAsJsonObject("region");
            int width=(Math.max(region.get("x1").getAsInt(),region.get("x2").getAsInt())>>4)-(Math.min(region.get("x1").getAsInt(),region.get("x2").getAsInt())>>4)+1;
            int depth=(Math.max(region.get("z1").getAsInt(),region.get("z2").getAsInt())>>4)-(Math.min(region.get("z1").getAsInt(),region.get("z2").getAsInt())>>4)+1;
            return op.get("_chunkIndex").getAsInt()>=width*depth;
        }
        long boxOffset(JsonObject o){return o.has("_offset")?o.get("_offset").getAsLong():0;}
        boolean boxFinished(JsonObject o){return boxOffset(o)>=(long)(Math.abs(o.get("x2").getAsInt()-o.get("x1").getAsInt())+1)*(Math.abs(o.get("y2").getAsInt()-o.get("y1").getAsInt())+1)*(Math.abs(o.get("z2").getAsInt()-o.get("z1").getAsInt())+1);}
        BlockState parseBlock(String s) throws CommandSyntaxException { return BlockStateParser.parseForBlock(BuiltInRegistries.BLOCK.asLookup(),s,false).blockState(); }
        void spawn(ServerLevel level, JsonObject op) throws CommandSyntaxException {
            ResourceLocation id=ResourceLocation.parse(op.get("entity").getAsString());
            if (!BuiltInRegistries.ENTITY_TYPE.containsKey(id)) throw new IllegalArgumentException("unknown entity " + id);
            EntityType<?> type=BuiltInRegistries.ENTITY_TYPE.get(id);
            Entity entity=type.create(level);
            if (entity==null) throw new IllegalStateException("entity creation failed for " + id);
            if (op.has("nbt")) entity.load(TagParser.parseTag(op.get("nbt").getAsString()));
            entity.moveTo(op.get("x").getAsDouble(),op.get("y").getAsDouble(),op.get("z").getAsDouble(),op.has("yaw")?op.get("yaw").getAsFloat():0,0);
            level.getChunkSource().getChunk(entity.blockPosition().getX()>>4,entity.blockPosition().getZ()>>4,ChunkStatus.FULL,true);
            if (!level.addFreshEntity(entity)) throw new IllegalStateException("entity not added at " + entity.blockPosition() + " for " + id);
            LOGGER.info("spawn {} uuid={} at {},{},{}", id,entity.getUUID(),entity.getX(),entity.getY(),entity.getZ());
        }
        void sign(ServerLevel l, JsonObject o) throws CommandSyntaxException { BlockPos p=new BlockPos(o.get("x").getAsInt(),o.get("y").getAsInt(),o.get("z").getAsInt()); l.setBlock(p,parseBlock(o.has("block")?o.get("block").getAsString():"minecraft:oak_wall_sign[facing=south]"),3); if(l.getBlockEntity(p) instanceof SignBlockEntity s){ JsonArray a=o.getAsJsonArray("lines"); var text=s.getFrontText(); for(int i=0;i<Math.min(4,a.size());i++)text=text.setMessage(i,net.minecraft.network.chat.Component.literal(a.get(i).getAsString())); s.setText(text,true); s.setChanged(); }}
        String summary(){return "job="+name+" op="+opIndex+"/"+operations.size()+" placed="+placed+" done="+done+" cancelled="+cancelled+(error.isEmpty()?"":" error="+error);}
        void save(){if(stateFile==null)return; try{JsonObject o=new JsonObject();o.addProperty("name",name);o.addProperty("source",file.toString());o.add("bounds",bounds);o.add("operations",operations);o.addProperty("opIndex",opIndex);o.addProperty("placed",placed);o.addProperty("done",done);o.addProperty("cancelled",cancelled);o.addProperty("error",error);Files.writeString(stateFile,GSON.toJson(o),StandardCharsets.UTF_8);}catch(IOException e){LOGGER.warn("state save failed",e);}}
    }
}
