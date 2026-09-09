/* NOOR reel · the shelf on Vercel Blob, one file at a time.
   ------------------------------------------------------------------------
   The videos used to live in the repository and ride along in every Vercel
   deployment: 1.3 GB of mp4 per deploy, a repository past 3 GB, and every
   re-render of the shelf adding the same again for good. They live on a
   Blob store now, which is what Blob is for, and the repository keeps only
   the small sidecar that says where each one went.

     node blob.mjs put <local file> <pathname>     prints the public URL
     node blob.mjs del <url>                        removes one object

   Needs BLOB_READ_WRITE_TOKEN in the environment (a GitHub secret in the
   workflow). The pathname is deterministic (no random suffix) and a re-render
   overwrites, so a card keeps one URL for its whole life and the manifest
   never has to change for a picture that was made again.

   With BLOB_FAKE_DIR set, the file is copied there instead and a file:// URL
   is printed: the tests use it; nothing else should. */
import fs from "node:fs";
import path from "node:path";

const [, , cmd, a, b] = process.argv;
const TYPES = { ".mp4": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".json": "application/json", ".png": "image/png" };

async function main() {
  if (cmd === "put") {
    if (!a || !b) throw new Error("put <local> <pathname>");
    const fake = process.env.BLOB_FAKE_DIR;
    if (fake) {
      const dest = path.join(fake, b);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(a, dest);
      process.stdout.write("file://" + dest + "\n");
      return;
    }
    const { put } = await import("@vercel/blob");
    const body = fs.readFileSync(a);
    const r = await put(b, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: TYPES[path.extname(b).toLowerCase()] || "application/octet-stream",
      cacheControlMaxAge: 60 * 60 * 24 * 365
    });
    process.stdout.write(r.url + "\n");
    return;
  }
  if (cmd === "del") {
    if (!a) throw new Error("del <url>");
    if (process.env.BLOB_FAKE_DIR) { try { fs.unlinkSync(a.replace(/^file:\/\//, "")); } catch {} return; }
    const { del } = await import("@vercel/blob");
    await del(a);
    return;
  }
  throw new Error("blob.mjs put|del");
}
main().catch(e => { process.stderr.write(String(e && e.message || e) + "\n"); process.exit(1); });
