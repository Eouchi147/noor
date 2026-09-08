/* NOOR · connecting Threads, once
   ===========================================================================
   Two doors and a window, the way YouTube's are.

     /api/threads?action=auth       the owner is sent to Threads' consent screen
     /threads/callback              Meta comes back with a code; it is traded
                                    for a short-lived token, that for a
                                    long-lived one, and the token and the
                                    user id are shown ONCE, kept nowhere
     /api/threads?action=renew      sixty more days on the token in Vercel:
                                    the new one is shown once, to be pasted in
     /api/threads?action=status     is it connected, whose account, how old

   The token is shown and not stored for the same reason the YouTube and
   Pinterest ones are: a token is a password, and the house does not keep a
   copy it was not asked to keep. The owner pastes it into Vercel as
   TH_TOKEN, and the user id beside it as TH_USER_ID. The state parameter is
   signed with ADMIN_SECRET and lives fifteen minutes, so a code that did not
   come from this house's own consent screen is refused.
--------------------------------------------------------------------------- */
import crypto from "crypto";
import * as TH from "./_threads.js";
import { ownerGate } from "./_owner.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function state(secret) {
  const exp = Date.now() + 15 * 60 * 1000;
  return exp + "." + crypto.createHmac("sha256", secret).update("th" + exp).digest("hex");
}
export function stateOk(st, secret) {
  if (!secret) return false;
  const [expStr, sig] = String(st || "").split(".");
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() > exp) return false;
  const want = crypto.createHmac("sha256", secret).update("th" + exp).digest("hex");
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

const days = s => Math.round(Number(s || 0) / 86400);

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  const q = req.query || {};
  const action = String(q.action || "status");
  const secret = process.env.ADMIN_SECRET || "";

  /* the callback carries no cookie of ours -- Meta sends the browser back
     cold -- so it proves itself with the signed state instead */
  const isCallback = action === "callback";
  if (!isCallback) {
    const gate = ownerGate(req);
    if (!gate.ok) return res.status(gate.code).json({ ok: false, reason: gate.reason });
  }

  if (action === "auth") {
    if (!TH.doorReady())
      return page(res, "Threads", "<h1>Threads is not ready</h1><p>Set <code>TH_APP_ID</code> and <code>TH_APP_SECRET</code> in Vercel first. They are the Threads app id and secret on the Meta app dashboard, under the Threads use case; the id is not a secret, the secret is.</p>", 400);
    if (!secret) return page(res, "Threads", "<h1>No ADMIN_SECRET</h1><p>The consent is signed with it; set it first.</p>", 400);
    res.setHeader("Cache-Control", "no-store");
    res.writeHead(302, { Location: TH.authUrl(host, state(secret)) });
    return res.end();
  }

  if (isCallback) {
    if (!stateOk(q.state, secret))
      return page(res, "Threads", "<h1>This did not start here</h1><p>The consent link has expired or was not made by this house. Start again from <a href=\"/api/threads?action=auth\">the beginning</a>.</p>", 400);
    if (String(q.error || ""))
      return page(res, "Threads", "<h1>Meta said no</h1><p>It returned <code>" + esc(q.error) + "</code>" + (q.error_description ? ": " + esc(q.error_description) : "") + ".</p><p><a href=\"/api/threads?action=auth\">Try again</a></p>", 400);
    const code = String(q.code || "");
    if (!code) return page(res, "Threads", "<h1>No code came back</h1><p><a href=\"/api/threads?action=auth\">Start again</a>.</p>", 400);
    const x = await TH.exchange(host, code);
    if (!x.ok)
      return page(res, "Threads", "<h1>The exchange failed</h1><p class=no>" + esc(x.err) + "</p><p>The usual cause is a redirect URI on the Threads use case that does not match this one exactly:</p><span class=v>" + esc(TH.redirectUri(host)) + "</span><p><a href=\"/api/threads?action=auth\">Try again</a></p>", 502);
    return page(res, "Threads connected",
      "<h1 class=ok>Meta said yes</h1>" +
      "<p>Copy these two into Vercel now, under Settings, Environment Variables, then redeploy. This page is the only time they are shown, and the house keeps no copy of them.</p>" +
      "<div class=k>TH_TOKEN</div><span class=v>" + esc(x.token) + "</span>" +
      "<div class=k>TH_USER_ID</div><span class=v>" + esc(x.userId || "") + "</span>" +
      "<p>The token lives " + (x.expiresIn ? days(x.expiresIn) : TH.TOKEN_LIFE_DAYS) + " days. Before it runs out, open <code>/api/threads?action=renew</code> and paste the fresh one in; the console says when.</p>" +
      "<p>From the next post on, the machine posts to Threads by itself: a card as its picture with the title and the link, a reel as the video with its caption.</p>");
  }

  if (action === "renew") {
    if (!TH.configured())
      return page(res, "Threads", "<h1>Nothing to renew</h1><p><code>TH_TOKEN</code> is not set. Start at <a href=\"/api/threads?action=auth\">the beginning</a>.</p>", 400);
    const x = await TH.refresh();
    if (!x.ok)
      return page(res, "Threads", "<h1>Meta would not renew it</h1><p class=no>" + esc(x.err) + "</p><p>A token less than a day old cannot be renewed yet; one that has expired cannot be renewed at all, and the door is opened again instead: <a href=\"/api/threads?action=auth\">consent</a>.</p>", 502);
    return page(res, "Threads renewed",
      "<h1 class=ok>Sixty more days</h1>" +
      "<p>Copy this into Vercel now as <code>TH_TOKEN</code>, replacing the old one, then redeploy. This page is the only time it is shown, and the house keeps no copy of it.</p>" +
      "<div class=k>TH_TOKEN</div><span class=v>" + esc(x.token) + "</span>" +
      "<p>It lives " + (x.expiresIn ? days(x.expiresIn) : TH.TOKEN_LIFE_DAYS) + " days from now.</p>");
  }

  if (action === "status") {
    const out = { ok: true, configured: TH.configured(), door: TH.doorReady(), redirect: TH.redirectUri(host),
                  missing: ["TH_APP_ID", "TH_APP_SECRET", "TH_TOKEN"].filter(k => !process.env[k]),
                  userId: process.env.TH_USER_ID ? "set" : "resolved from /me when needed",
                  dailyLimit: TH.DAILY_LIMIT, tokenLifeDays: TH.TOKEN_LIFE_DAYS };
    if (out.configured) {
      const age = await TH.tokenAge();
      out.tokenDays = age.days; out.renew = !!age.renew;
      if (String(q.probe || "") === "1") {
        const m = await TH.me(undefined, { fresh: true });
        out.account = m.ok ? { id: m.id, username: m.username } : ("refused: " + m.err);
      }
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(out);
  }

  return res.status(400).json({ ok: false, error: "no such action" });
}
