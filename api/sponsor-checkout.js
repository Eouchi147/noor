// Regional sponsorship was retired when the house moved to two streams:
// Gifts and Licensing. This endpoint remains only to close the door kindly.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(410).json({
    error: "This program has been retired.",
    message: "Guardians of the Codex now names the givers. Gifts live at /donate; institutional licensing at /license."
  });
}
