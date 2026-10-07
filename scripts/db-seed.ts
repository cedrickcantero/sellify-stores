import { config as loadEnv } from "dotenv";
import { seedDeviceCatalog } from "../src/data/maintenance";

loadEnv({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

// Seeds the global device catalog only. Shop content for the FixIt Galway demo
// is entered through the backend, and test shops come from seedTwoShops().
const count = await seedDeviceCatalog(url);
console.log(`Device catalog seeded: ${count} models.`);
