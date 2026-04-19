import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const app = new Hono();

const SCENARIOS_DIR = join(import.meta.dir, "scenarios");

// --- API: Teams ---
app.get("/api/teams", async (c) => {
  const { TEAMS } = await import("./public/js/renderer/teams.js");
  return c.json(TEAMS);
});

// --- API: List scenarios for a tier ---
app.get("/api/scenarios/:tier", async (c) => {
  const tier = c.req.param("tier");
  const tierDir = join(SCENARIOS_DIR, tier);

  try {
    const files = await readdir(tierDir);
    const scenarios = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const raw = await readFile(join(tierDir, f), "utf-8");
          const data = JSON.parse(raw);
          return {
            ...data,
            id: f.replace(".json", ""),
            title: data.title ?? f.replace(".json", ""),
          };
        })
    );
    return c.json(scenarios);
  } catch {
    return c.json([]);
  }
});

// --- API: Load a specific scenario ---
app.get("/api/scenarios/:tier/:id", async (c) => {
  const { tier, id } = c.req.param();
  const filePath = join(SCENARIOS_DIR, tier, `${id}.json`);

  try {
    const raw = await readFile(filePath, "utf-8");
    return c.json(JSON.parse(raw));
  } catch {
    return c.json({ error: "Scenario not found" }, 404);
  }
});

// --- Static files (AFTER API routes so /api/* matches first) ---
app.use("/*", serveStatic({ root: "./public" }));

const port = parseInt(process.env.PORT ?? "3456", 10);

export default {
  port,
  fetch: app.fetch,
};

console.log(`Diamond IQ server running on port ${port}`);
