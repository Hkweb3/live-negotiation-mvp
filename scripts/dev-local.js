const { execSync, spawn } = require("node:child_process");

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  execSync("docker compose up -d postgres redis", { stdio: "inherit" });

  let migrated = false;
  for (let attempt = 1; attempt <= 25; attempt += 1) {
    try {
      execSync(`${npmCommand} run prisma:migrate`, { stdio: "inherit" });
      migrated = true;
      break;
    } catch {
      console.log(`Database not ready yet (attempt ${attempt}/25). Retrying in 2s...`);
      await sleep(2000);
    }
  }

  if (!migrated) {
    console.error("Failed to apply migrations after waiting for database readiness.");
    process.exit(1);
  }

  const devProcess = spawn(npmCommand, ["run", "dev"], { stdio: "inherit" });

  const shutdown = () => {
    if (!devProcess.killed) {
      devProcess.kill("SIGINT");
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  devProcess.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
