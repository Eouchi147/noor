/* NOOR · connecting YouTube, once
   ===========================================================================
   Two doors and a window.

     /api/youtube?action=auth       the owner is sent to Google's consent screen
     /youtube/callback              Google comes back with a code; it is traded
                                    for a refresh token, shown ONCE, kept nowhere
     /api/youtube?action=status     is it connected, and how many went up today

   The token is shown and not stored for the same reason the Pinterest one is:
   a refresh token is a password, and the house does not keep a copy it was
   not asked to keep. The owner pastes it into Vercel as YT_REFRESH_TOKEN,
   which is the only place it belongs. The state parameter is signed with
   ADMIN_SECRET and lives fifteen minutes, so a code that did not come from
   this house's own consent screen is refused.
--------------------------------------------------------------------------- */
import crypto from "crypto";
import * as YT from "./_youtube.js";
import { ownerGate } from "./_owner.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function state(secret) {
  const exp = Date.now() + 15 * 60 * 1000;
  return exp + "." + crypto.createHmac("sha256", secret).update("yt" + exp).digest("hex");
}
function stateOk(st, secret) {
  if (!secret) return false;
  const [expStr, sig] = String(st || "").split(".");
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() > exp) return false;
  const want = crypto.createHmac("sha256", secret).update("yt" + exp).digest("hex");
  const A = Buffer.from(sig || ""), B = Buffer.from(want);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function page(res, title, bodyHtml, code = 200) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  return res.status(code).send('<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">' +
    "<title>" + esc(title) + " · NOOR</title><style>" +
    "body{margin:0;background:#0F1630;color:#EEF1FA;font:16px/1.6 system-ui,sans-serif;padding:28px 18px}" +
    ".w{max-width:640px;margin:0 auto}h1{font-size:26px;margin:0 0 14px;color:#E9C86A}" +
    "p{color:#A9B3D6;max-width:60ch}code,.v{font-family:ui-monospace,Menlo,monospace;font-size:13px}" +
    ".v{display:block;background:#0B1129;border:1px solid #2B3766;border-radius:10px;padding:12px 14px;" +
    "margin:6px 0 16px;word-break:break-all;color:#EEF1FA}" +
    ".k{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#E9C86A;margin-top:14px}" +
    "a{color:#E9C86A}.ok{color:#7FD1AE}.no{color:#F0876A}" +
    "</style><div class=w>" + bodyHtml + "</div>");
}

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  const q = req.query || {};
  const action = String(q.action || "status");
  const secret = process.env.ADMIN_SECRET || "";

  /* the callback carries no cookie of ours -- Google sends the browser back
     cold -- so it proves itself with the signed state instead */
  const isCallback = action === "callback";
  if (!isCallback) {
    const gate = ownerGate(req);
    if (!gate.ok) return res.status(gate.code).json({ ok: false, reason: gate.reason });
  }

  if (action === "auth") {
    if (!process.env.YT_CLIENT_ID || !process.env.YT_CLIENT_SECRET)
      return page(res, "YouTube", "<h1>YouTube is not ready</h1><p>Set <code>YT_CLIENT_ID</code> and <code>YT_CLIENT_SECRET</code> in Vercel first. They are the OAuth client on the Google Cloud console; the id is not a secret, the secret is.</p>", 400);
    if (!secret) return page(res, "YouTube", "<h1>No ADMIN_SECRET</h1><p>The consent is signed with it; set it first.</p>", 400);
    res.setHeader("Cache-Control", "no-store");
    res.writeHead(302, { Location: YT.authUrl(host, state(secret)) });
    return res.end();
  }

  if (isCallback) {
    if (!stateOk(q.state, secret))
      return page(res, "YouTube", "<h1>This did not start here</h1><p>The consent link has expired or was not made by this house. Start again from <a href=\"/api/youtube?action=auth\">the beginning</a>.</p>", 400);
    if (String(q.error || ""))
      return page(res, "YouTube", "<h1>Google said no</h1><p>It returned <code>" + esc(q.error) + "</code>.</p><p><a href=\"/api/youtube?action=auth\">Try again</a></p>", 400);
    const code = String(q.code || "");
    if (!code) return page(res, "YouTube", "<h1>No code came back</h1><p><a href=\"/api/youtube?action=auth\">Start again</a>.</p>", 400);
    const x = await YT.exchange(host, code);
    if (!x.ok)
      return page(res, "YouTube", "<h1>The exchange failed</h1><p class=no>" + esc(x.err) + "</p><p>The usual cause is a redirect URI on the OAuth client that does not match this one exactly:</p><span class=v>" + esc(YT.redirectUri(host)) + "</span><p><a href=\"/api/youtube?action=auth\">Try again</a></p>", 502);
    return page(res, "YouTube connected",
      "<h1 class=ok>Google said yes</h1>" +
      "<p>Copy this into Vercel now, under Settings, Environment Variables, then redeploy. This page is the only time it is shown, and the house keeps no copy of it.</p>" +
      "<div class=k>YT_REFRESH_TOKEN</div><span class=v>" + esc(x.refresh) + "</span>" +
      "<p>Scope granted: <code>" + esc(x.scope || YT.SCOPE) + "</code>.</p>" +
      "<p>From the next reel on, the machine uploads to YouTube Shorts by itself. Until the project passes Google's API audit, every upload lands as private; the console says so on the row.</p>");
  }

  if (action === "status") {
    const date = new Date().toISOString().slice(0, 10);
    const out = { ok: true, configured: YT.configured(), usedToday: await YT.usedToday(date), cap: YT.DAILY_CAP,
                  redirect: YT.redirectUri(host),
                  missing: ["YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"].filter(k => !process.env[k]) };
    if (out.configured && String(q.probe || "") === "1") {
      const t = await YT.accessToken(undefined, { fresh: true });
      out.token = t.ok ? "minted" : ("refused: " + t.err);
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(out);
  }

  return res.status(400).json({ ok: false, error: "no such action" });
}
