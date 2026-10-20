package com.example.examplemod;

import com.google.gson.*;
import net.minecraft.commands.arguments.blocks.BlockStateParser;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.nbt.TagParser;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.storage.LevelResource;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Set;

final class ParkValidate {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    record Result(String summary, int invalid) {}

    static Result run(MinecraftServer server, String name) throws Exception {
        Path source = server.getFile("../../map/generated/" + name + ".json").normalize();
        byte[] bytes = Files.readAllBytes(source);
        JsonObject plan = JsonParser.parseString(new String(bytes, StandardCharsets.UTF_8)).getAsJsonObject();
        JsonArray operations = plan.getAsJsonArray("operations");
        if (operations == null) throw new IllegalArgumentException("operations missing");
        JsonArray issues = new JsonArray();
        Set<String> validBlocks = new HashSet<>();
        int invalid = 0;
        for (int i = 0; i < operations.size(); i++) {
            JsonObject op = operations.get(i).getAsJsonObject();
            String kind = op.get("kind").getAsString();
            try {
                switch (kind) {
                    case "box" -> {
                        checkBlock(op.get("block").getAsString(), validBlocks);
                        if (op.has("replace")) checkBlock(op.get("replace").getAsString(), validBlocks);
                    }
                    case "sign" -> {
                        checkBlock(op.has("block") ? op.get("block").getAsString() : "minecraft:oak_wall_sign[facing=south]", validBlocks);
                        if (!op.has("lines") || !op.get("lines").isJsonArray()) throw new IllegalArgumentException("sign lines missing");
                    }
                    case "spawn" -> {
                        ResourceLocation id = ResourceLocation.parse(op.get("entity").getAsString());
                        if (!BuiltInRegistries.ENTITY_TYPE.containsKey(id)) throw new IllegalArgumentException("unknown entity " + id);
                        if (op.has("nbt")) TagParser.parseTag(op.get("nbt").getAsString());
                    }
                    case "command" -> {
                        String command = op.get("command").getAsString();
                        if (command.startsWith("/")) command = command.substring(1);
                        var parsed = server.getCommands().getDispatcher().parse(command, server.createCommandSourceStack().withPermission(4));
                        if (parsed.getReader().canRead() || parsed.getContext().getCommand() == null)
                            throw new IllegalArgumentException("invalid command at " + parsed.getReader().getCursor() + ": " + command);
                    }
                    case "removeEntities" -> {
                        if (!op.has("region")) throw new IllegalArgumentException("region missing");
                    }
                    default -> throw new IllegalArgumentException("unsupported operation " + kind);
                }
            } catch (Exception ex) {
                invalid++;
                if (issues.size() < 1000) {
                    JsonObject issue = new JsonObject();
                    issue.addProperty("index", i);
                    issue.addProperty("kind", kind);
                    issue.addProperty("message", ex.getMessage());
                    if (op.has("block")) issue.addProperty("block", op.get("block").getAsString());
                    issues.add(issue);
                }
            }
        }
        JsonObject report = new JsonObject();
        report.addProperty("worldName", server.getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize().getFileName().toString());
        report.addProperty("planName", name);
        report.addProperty("planSha256", HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
        report.addProperty("checked", operations.size());
        report.addProperty("invalid", invalid);
        report.add("issues", issues);
        Path output = server.getFile("parkbuild-validate-" + name + ".json");
        Files.writeString(output, GSON.toJson(report), StandardCharsets.UTF_8);
        return new Result("validated " + name + " checked=" + operations.size() + " invalid=" + invalid + " report=" + output, invalid);
    }

    private static void checkBlock(String text, Set<String> validBlocks) throws Exception {
        if (!validBlocks.contains(text)) {
            BlockStateParser.parseForBlock(BuiltInRegistries.BLOCK.asLookup(), text, false);
            validBlocks.add(text);
        }
    }
}
