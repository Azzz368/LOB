import { getStore } from "@netlify/blobs";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

const siteId = process.env.SITE_ID;
const token = process.env.NETLIFY_TOKEN;

if (!siteId || !token) {
  console.error("Missing SITE_ID or NETLIFY_TOKEN in environment.");
  process.exit(1);
}

const store = getStore({
  name: "poems-data",
  siteID: siteId,
  token,
});

const outputDir = path.resolve("data");
fs.mkdirSync(outputDir, { recursive: true });

const submissions = (await store.get("submissions", { type: "json" })) || [];
const poems = (await store.get("poems", { type: "json" })) || { poems: [], updatedAt: new Date().toISOString() };

const submissionsPath = path.join(outputDir, "netlify-submissions.json");
const poemsPath = path.join(outputDir, "netlify-poems.json");

fs.writeFileSync(submissionsPath, JSON.stringify(submissions, null, 2));
fs.writeFileSync(poemsPath, JSON.stringify(poems, null, 2));

console.log(`Exported ${submissions.length} submissions to ${submissionsPath}`);
console.log(`Exported ${Array.isArray(poems.poems) ? poems.poems.length : 0} poems to ${poemsPath}`);
