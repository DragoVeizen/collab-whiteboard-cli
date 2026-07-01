// M4 stub: CLI entry point. Impl throws.

async function main(): Promise<void> {
  throw new Error("M4 not implemented: CLI entry");
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
