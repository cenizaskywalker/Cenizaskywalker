import { env } from "cloudflare:workers";
import {
  applyD1Migrations,
  type D1Migration,
} from "cloudflare:test";
import type { AppEnv } from "./types";

interface TestEnv extends AppEnv {
  TEST_MIGRATIONS: D1Migration[];
}

const testEnv = env as TestEnv;

await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
