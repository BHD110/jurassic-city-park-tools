package com.example.examplemod;

import com.google.gson.*;
import com.mojang.logging.LogUtils;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.decoration.ArmorStand;
import net.minecraft.world.entity.vehicle.Minecart;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.block.BaseRailBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.LevelResource;
import net.minecraft.world.phys.Vec3;
import org.slf4j.Logger;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;

final class RailTest {
    private static final Logger LOGGER = LogUtils.getLogger();
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final int MIN_TICKS = 6000;
    private static final int MAX_TICKS = 48000;
    private static final int SAMPLE_INTERVAL = 100;

    private final Path output;
    private final String worldName, planFileName, planName, planSha256, routeSha256;
    private final JsonArray points;
    private final JsonArray observations = new JsonArray();
    private final ServerLevel level;
    private final Minecart cart;
    private final ArmorStand passenger;
    private final Set<Long> forcedChunks = new HashSet<>();
    private final Instant startedAt = Instant.now();
    private final int startedTick;
    private final double stationX, stationY, stationZ;
    private double lastX, lastZ;
    private int ticks, stationaryTicks, completedLaps, minTps = 20;
    private int farthestIndex, lastNearestIndex, lastSampleTick, milestonesReached, maxForwardJump;
    private boolean running = true;
    private String result = "running";

    private RailTest(MinecraftServer server, JsonObject route, String planFileName, String planName, String planSha256, String routeSha256) {
        this.level = server.overworld();
        this.output = server.getFile(planFileName.equals("full") ? "parkbuild-railtest.json" : "parkbuild-railtest-" + planFileName + ".json");
        this.worldName = server.getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize().getFileName().toString();
        this.planFileName = planFileName;
        this.planName = planName;
        this.planSha256 = planSha256;
        this.routeSha256 = routeSha256;
        this.points = route.getAsJsonArray("points");
        JsonObject station = route.getAsJsonObject("station");
        this.stationX = station.get("x").getAsDouble();
        this.stationY = station.get("y").getAsDouble();
        this.stationZ = station.get("z").getAsDouble();
        this.startedTick = server.getTickCount();
        this.cart = new Minecart(level, stationX + 0.5, stationY + 0.1, stationZ + 0.5);
        this.passenger = new ArmorStand(level, stationX + 0.5, stationY + 0.1, stationZ + 0.5);
        passenger.setInvisible(true);
        passenger.setNoGravity(true);
        passenger.setInvulnerable(true);
        passenger.setSilent(true);
        passenger.setCustomName(Component.literal("Rail test passenger"));
        lastX = cart.getX();
        lastZ = cart.getZ();
    }

    static RailTest start(MinecraftServer server, String requestedPlan) throws IOException {
        String planFileName = requestedPlan == null ? "full" : requestedPlan;
        byte[] planBytes = Files.readAllBytes(server.getFile("../../map/generated/" + planFileName + ".json").normalize());
        JsonObject plan = JsonParser.parseString(new String(planBytes, StandardCharsets.UTF_8)).getAsJsonObject();
        JsonObject route;
        String routeSha256;
        if (requestedPlan == null) {
            byte[] routeBytes = Files.readAllBytes(server.getFile("../../map/generated/route.json").normalize());
            route = JsonParser.parseString(new String(routeBytes, StandardCharsets.UTF_8)).getAsJsonObject();
            routeSha256 = sha256(routeBytes);
        } else {
            if (!plan.has("route") || !plan.get("route").isJsonObject()) throw new IOException("plan has no embedded route");
            route = plan.getAsJsonObject("route");
            routeSha256 = sha256(route.toString().getBytes(StandardCharsets.UTF_8));
        }
        if (!route.has("points") || !route.get("points").isJsonArray() || route.getAsJsonArray("points").size() < 100)
            throw new IOException("route has too few points");
        if (!route.has("station") || !route.get("station").isJsonObject()) throw new IOException("route has no station");
        if (requestedPlan != null) {
            JsonObject metadata = plan.getAsJsonObject("metadata");
            if (metadata == null || !metadata.has("routeLength") || metadata.get("routeLength").getAsInt() != route.getAsJsonArray("points").size())
                throw new IOException("plan metadata.routeLength does not match embedded route");
        }
        RailTest test = new RailTest(server, route, planFileName, plan.get("name").getAsString(), sha256(planBytes), routeSha256);
        test.forceNearbyChunks(0);
        BlockState stationRail = test.level.getBlockState(new BlockPos((int)test.stationX,(int)test.stationY,(int)test.stationZ));
        if (!(stationRail.getBlock() instanceof BaseRailBlock)) throw new IOException("station rail not present at route start");
        if (!test.level.addFreshEntity(test.cart) || !test.level.addFreshEntity(test.passenger)) throw new IOException("could not spawn test cart and passenger");
        test.passenger.startRiding(test.cart, true);
        JsonObject next = test.points.get(1).getAsJsonObject();
        double dx = Math.signum(next.get("x").getAsDouble() - test.stationX);
        double dz = Math.signum(next.get("z").getAsDouble() - test.stationZ);
        test.cart.setDeltaMovement(dx * 0.25, 0, dz * 0.25);
        LOGGER.info("Rail test started cart={} passenger={}", test.cart.getUUID(), test.passenger.getUUID());
        return test;
    }

    private static String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException ex) { throw new IllegalStateException("SHA-256 unavailable", ex); }
    }

    boolean running() { return running; }
    String summary() { return "railtest=" + result + " ticks=" + ticks + " laps=" + completedLaps + " stationaryTicks=" + stationaryTicks + " cart=" + cart.getUUID(); }

    void tick(MinecraftServer server) {
        if (!running) return;
        ticks = server.getTickCount() - startedTick;
        if (!cart.isAlive() || !passenger.isAlive()) { stop(server, "cart or passenger lost"); return; }
        int nearest = nearestPoint();
        boolean wrap = lastNearestIndex > points.size() * 0.95 && nearest < points.size() * 0.05;
        int forwardJump = nearest - lastNearestIndex + (wrap ? points.size() : 0);
        if (forwardJump > 8 || forwardJump < -4) {
            stop(server, "route progress jumped by " + forwardJump + " points");
            return;
        }
        maxForwardJump = Math.max(maxForwardJump, Math.max(0, forwardJump));
        farthestIndex = Math.max(farthestIndex, nearest);
        if (milestonesReached < 9 && nearest >= (milestonesReached + 1) * points.size() / 10) milestonesReached++;
        if (wrap && milestonesReached >= 9) {
            completedLaps++;
            farthestIndex = 0;
            milestonesReached = 0;
        }
        lastNearestIndex = nearest;
        forceNearbyChunks(nearest);
        double moved = Math.hypot(cart.getX() - lastX, cart.getZ() - lastZ);
        stationaryTicks = moved < 0.005 ? stationaryTicks + 1 : 0;
        lastX = cart.getX(); lastZ = cart.getZ();
        long averageTickNs = server.getAverageTickTimeNanos();
        if (averageTickNs > 0) minTps = Math.min(minTps, (int)Math.min(20, 1_000_000_000d / averageTickNs));
        if (ticks - lastSampleTick >= SAMPLE_INTERVAL) { record(nearest, moved); lastSampleTick = ticks; }
        if (stationaryTicks > 100) { stop(server, "cart stopped for over 5 seconds"); return; }
        if (ticks >= MIN_TICKS && completedLaps >= 1) { stop(server, "completed"); return; }
        if (ticks >= MAX_TICKS) stop(server, "timeout without a complete lap");
    }

    private int nearestPoint() {
        int best = 0;
        double bestDistance = Double.MAX_VALUE;
        for (int i=0; i<points.size(); i++) {
            JsonObject point = points.get(i).getAsJsonObject();
            double dx = point.get("x").getAsDouble() + 0.5 - cart.getX();
            double dz = point.get("z").getAsDouble() + 0.5 - cart.getZ();
            double distance = dx*dx + dz*dz;
            if (distance < bestDistance) { bestDistance = distance; best = i; }
        }
        return best;
    }

    private void forceNearbyChunks(int nearest) {
        Set<Long> needed = new HashSet<>();
        for (int i=-32; i<=96; i+=4) {
            JsonObject point = points.get(Math.floorMod(nearest+i, points.size())).getAsJsonObject();
            int cx = point.get("x").getAsInt() >> 4, cz = point.get("z").getAsInt() >> 4;
            needed.add(ChunkPos.asLong(cx,cz));
        }
        needed.add(ChunkPos.asLong(cart.blockPosition()));
        for (long chunk : needed) if (forcedChunks.add(chunk)) level.setChunkForced(ChunkPos.getX(chunk),ChunkPos.getZ(chunk),true);
        for (Iterator<Long> it=forcedChunks.iterator(); it.hasNext();) {
            long chunk=it.next();
            if (!needed.contains(chunk)) { level.setChunkForced(ChunkPos.getX(chunk),ChunkPos.getZ(chunk),false); it.remove(); }
        }
    }

    private void record(int nearest, double moved) {
        JsonObject sample = new JsonObject();
        sample.addProperty("atSeconds", ticks / 20d);
        sample.addProperty("x", cart.getX()); sample.addProperty("y", cart.getY()); sample.addProperty("z", cart.getZ());
        sample.addProperty("speed", moved * 20d);
        sample.addProperty("stationaryTicks", stationaryTicks);
        sample.addProperty("routeIndex", nearest);
        sample.addProperty("milestonesReached", milestonesReached);
        sample.addProperty("zone", points.get(nearest).getAsJsonObject().get("zone").getAsString());
        observations.add(sample);
    }

    void stop(MinecraftServer server, String reason) {
        if (!running) return;
        running = false;
        result = reason;
        record(nearestPoint(), 0);
        Instant endedAt = Instant.now();
        JsonObject report = new JsonObject();
        report.addProperty("startedAt", startedAt.toString());
        report.addProperty("endedAt", endedAt.toString());
        report.addProperty("elapsedSeconds", (endedAt.toEpochMilli()-startedAt.toEpochMilli())/1000d);
        report.addProperty("completedLaps", completedLaps);
        report.addProperty("source", "server-minecart");
        report.addProperty("worldName", worldName);
        report.addProperty("planFileName", planFileName);
        report.addProperty("planName", planName);
        report.addProperty("planSha256", planSha256);
        report.addProperty("routeSha256", routeSha256);
        report.addProperty("result", result);
        report.addProperty("serverTicks", ticks);
        report.addProperty("maxForwardJump", maxForwardJump);
        report.addProperty("minTps", minTps);
        report.addProperty("cartUUID", cart.getUUID().toString());
        report.addProperty("passengerUUID", passenger.getUUID().toString());
        report.add("observations", observations);
        try { Files.writeString(output, GSON.toJson(report), StandardCharsets.UTF_8); }
        catch (IOException ex) { LOGGER.error("Could not write rail test report", ex); }
        for (long chunk:forcedChunks) level.setChunkForced(ChunkPos.getX(chunk),ChunkPos.getZ(chunk),false);
        forcedChunks.clear();
        passenger.discard(); cart.discard();
        LOGGER.info("Rail test {} after {} ticks, {} laps", result, ticks, completedLaps);
    }
}
