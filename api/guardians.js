// The public face of the retired regional sponsorship program.
// It answers, kindly and cheaply, that the program is gone.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=86400");
  return res.status(410).json({ retired: true, message: "Regional sponsorship has been retired. Gifts live at /donate." });
}
