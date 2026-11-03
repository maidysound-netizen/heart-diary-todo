import "server-only";
import path from "node:path";
import { SCHEMA } from "./schema";

type Row = Record<string, unknown>;
type Runner = (text: string, params?: unknown[]) => Promise<Row[]>;

let runnerPromise: Promise<Runner> | null = null;

async function createRunner(): Promise<Runner> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    const run: Runner = async (text, params = []) => (await sql.query(text, params)) as Row[];
    await ensureSchema(run);
    return run;
  }
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다 (Neon 연결 필요).");
  }
  // 로컬 개발용: 프로젝트 안의 .pglite 폴더에 실제 Postgres(WASM)로 저장한다.
  const { PGlite } = await import("@electric-sql/pglite");
  const g = globalThis as unknown as { __pglite?: InstanceType<typeof PGlite> };
  g.__pglite ??= new PGlite(path.join(process.cwd(), ".pglite"));
  const db = g.__pglite;
  const run: Runner = async (text, params = []) => (await db.query<Row>(text, params)).rows;
  await db.exec(SCHEMA);
  return run;
}

async function ensureSchema(run: Runner) {
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await run(stmt);
  }
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  runnerPromise ??= createRunner().catch((e) => {
    runnerPromise = null;
    throw e;
  });
  const run = await runnerPromise;
  return (await run(text, params)) as T[];
}
