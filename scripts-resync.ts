import { syncContasPagar, syncContasReceber } from "./src/lib/conta-azul/sync.server";

async function main() {
  const from = process.argv[2];
  const to = process.argv[3];
  if (!from || !to) throw new Error("uso: FROM TO");
  console.log(`>>> pagar ${from}..${to}`);
  const p = await syncContasPagar(from, to);
  console.log(`   pagar: ${p}`);
  console.log(`>>> receber ${from}..${to}`);
  const r = await syncContasReceber(from, to);
  console.log(`   receber: ${r}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("ERR", e); process.exit(1); });
