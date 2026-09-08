// Restore only the pinned RepDB images required by this app, never the dataset.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const root = path.resolve(__dirname, "../app/src/main/assets");
const manifest = require("../app/src/main/assets/media-manifest.json");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

async function download(url) {
  // Node 22 fetch does not use proxy environment variables. curl supports them.
  if (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy
  ) {
    const { stdout } = await run(
      "curl",
      [
        "--disable",
        "--fail",
        "--silent",
        "--show-error",
        "--proto",
        "=https",
        "--max-time",
        "60",
        "--retry",
        "2",
        "--url",
        url,
      ],
      {
        encoding: "buffer",
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
      },
    );
    return stdout;
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    redirect: "error",
  });
  if (!response.ok) throw Error(`Upstream HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const license = await fs.readFile(
    path.join(root, "licenses/repdb-free-tier.md"),
  );
  if (sha(license) !== manifest.licenseSha256)
    throw Error("RepDB license hash mismatch");
  const prefix = `https://raw.githubusercontent.com/RepDB/exercise-dataset/${manifest.revision}/images/flat/`;
  for (const file of manifest.files) {
    if (
      !/^movements\/repdb-[a-z0-9-]+\.webp$/.test(file.path) ||
      !file.sourceUrl.startsWith(prefix)
    )
      throw Error("Unexpected media path or upstream");
    const target = path.join(root, file.path);
    const current = await fs.readFile(target).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (current && current.length === file.size && sha(current) === file.sha256)
      continue;
    const bytes = await download(file.sourceUrl);
    if (
      bytes.length !== file.size ||
      sha(bytes) !== file.sha256 ||
      bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WEBP"
    )
      throw Error(`Media integrity check failed: ${file.path}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }
  console.log(
    `Verified ${manifest.files.length} pinned RepDB images for in-app use. Exercise data by RepDB (repdb.co).`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
