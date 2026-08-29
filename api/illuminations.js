// The Lantern's illuminations · every shared, cached AI light of the Codex
// in one endpoint (Vercel's free plan allows 12 functions; this one holds
// five lights). Each kind is generated once per day (Friday: once per week)
// and CDN-cached, so all readers on earth share a handful of queries a day.
//   ?kind=light     · Today's Light (history fact, 30-day memory via ?date=)
//   ?kind=verse     · The Verse Lamp (curated ayah + reflection)
//   ?kind=thread    · The Hidden Thread (a connection between two rooms)
//   ?kind=question  · The Seeker's Question (one honest answer a day)
//   ?kind=friday    · Friday Light (weekly Jumu'ah reflection)
// Truth rules: verses and questions come from curated static lists, links
// only from a whitelist; the AI writes reflection, never scripture, and
// every kind has a hand-written fallback so no tile ever goes dark.

/* The lantern's minds: free models only. OPENROUTER_MODEL is honoured only if
   it names a free one, unless ALLOW_PAID_MODELS=1 says otherwise. See
   api/_models.js. (The reader-set model first (env OPENROUTER_MODEL,
   which now requires ALLOW_PAID_MODELS=1 to be paid), then the best free
   lights of the day, in order. First to answer wins. */
import net from "node:net";
import { isFree, allowPaid, liveChain } from "./_models.js";
import { chooseLight, libraryInfo, hijriOf } from "./_lights.js";
import tls from "node:tls";

/* ---------- the store, whoever provides it ----------
   Reads readers' counts from either an Upstash-style REST endpoint
   (KV_REST_API_URL + KV_REST_API_TOKEN, which Vercel's KV and the
   Upstash marketplace both set) or from ANY ordinary Redis over its
   native protocol (REDIS_URL, as Redis Cloud and the rest give it),
   spoken by hand so the project needs no npm package and no build.
   This block is deliberately repeated in the two files that count,
   so a bundler can never come between the lamp and its oil. */
const REST_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOK = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const CONN = () => process.env.REDIS_URL || process.env.KV_URL || process.env.REDIS_TLS_URL || "";
function restFromConn() {
  const c = CONN();
  if (!/^https?:\/\//i.test(c)) return null;
  try { const u = new URL(c); const t = u.password || u.username || REST_TOK(); return t ? { url: u.origin, token: t } : null; }
  catch { return null; }
}
function kvKind() {
  if (REST_URL() && REST_TOK()) return "rest";
  if (restFromConn()) return "rest";
  if (/^rediss?:\/\//i.test(CONN())) return "socket";
  return "none";
}
const kvReady = () => kvKind() !== "none";
async function viaRest(cmds) {
  const f = restFromConn();
  const url = (REST_URL() && REST_TOK()) ? REST_URL() : f.url;
  const token = (REST_URL() && REST_TOK()) ? REST_TOK() : f.token;
  const r = await fetch(url.replace(/\/+$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error("kv rest " + r.status);
  const j = await r.json();
  return (Array.isArray(j) ? j : []).map(x => (x && Object.prototype.hasOwnProperty.call(x, "result")) ? x.result : null);
}
function respEncode(cmd) {
  const p = cmd.map(String);
  let s = "*" + p.length + "\r\n";
  for (const a of p) s += "$" + Buffer.byteLength(a) + "\r\n" + a + "\r\n";
  return s;
}
function respParse(buf) {
  const values = []; let i = 0;
  function one() {
    if (i >= buf.length) return undefined;
    const t = buf[i], nl = buf.indexOf("\r\n", i);
    if (nl === -1) return undefined;
    const head = buf.slice(i + 1, nl);
    if (t === 43 || t === 45) { i = nl + 2; return t === 45 ? null : head.toString(); }
    if (t === 58) { i = nl + 2; return parseInt(head.toString(), 10); }
    if (t === 36) {
      const len = parseInt(head.toString(), 10);
      if (len === -1) { i = nl + 2; return null; }
      const st = nl + 2, en = st + len;
      if (buf.length < en + 2) return undefined;
      const v = buf.slice(st, en).toString(); i = en + 2; return v;
    }
    if (t === 42) {
      const n = parseInt(head.toString(), 10); i = nl + 2;
      if (n === -1) return null;
      const arr = [];
      for (let k = 0; k < n; k++) { const v = one(); if (v === undefined) return undefined; arr.push(v); }
      return arr;
    }
    i = nl + 2; return null;
  }
  for (;;) { const mark = i; const v = one(); if (v === undefined) { i = mark; break; } values.push(v); }
  return { values, rest: buf.slice(i) };
}
function viaSocket(cmds) {
  const u = new URL(CONN());
  const secure = u.protocol === "rediss:";
  const pass = decodeURIComponent(u.password || ""), user = decodeURIComponent(u.username || "");
  const db = (u.pathname || "").replace(/^\//, "");
  const pre = [];
  if (pass) pre.push(user ? ["AUTH", user, pass] : ["AUTH", pass]);
  if (db && db !== "0") pre.push(["SELECT", db]);
  const all = pre.concat(cmds);
  return new Promise((resolve, reject) => {
    let done = false;
    const opts = { host: u.hostname, port: parseInt(u.port, 10) || 6379 };
    const sock = secure ? tls.connect({ ...opts, servername: u.hostname }) : net.connect(opts);
    const finish = (e, v) => { if (done) return; done = true; try { sock.end(); } catch {} e ? reject(e) : resolve(v); };
    sock.setTimeout(6000);
    let buf = Buffer.alloc(0), got = [];
    sock.on(secure ? "secureConnect" : "connect", () => sock.write(all.map(respEncode).join("")));
    sock.on("data", d => {
      buf = Buffer.concat([buf, d]);
      const p = respParse(buf); buf = p.rest; got = got.concat(p.values);
      if (got.length >= all.length) finish(null, got.slice(pre.length));
    });
    sock.on("timeout", () => finish(new Error("kv timeout")));
    sock.on("error", e => finish(e));
    sock.on("close", () => { if (!done) finish(null, got.slice(pre.length)); });
  });
}
async function kv(cmds) {
  if (!cmds || !cmds.length) return [];
  const k = kvKind();
  if (k === "rest") return viaRest(cmds);
  if (k === "socket") return viaSocket(cmds);
  throw new Error("no store configured");
}

/* the chain lives in api/_models.js now, free only unless paid is allowed */
/* the synchronous chain was defined here and never called. Removed rather
   than left as a loaded gun: it is empty on every cold start. */

/* ---------- Today's Light treasury (fallback) ---------- */
const TREASURY = [
  { category: "Founders", title: "A woman founded the world's oldest university", story: "In 859 CE, Fatima al-Fihri, a Muslim woman in Fez, spent her inheritance to found al-Qarawiyyin, recognized by UNESCO and Guinness as the oldest continuously operating degree-granting university on earth. It still teaches today.", detail: "Fez, Morocco · 859 CE" },
  { category: "Optics", title: "The scientific method has a father from Basra", story: "Ibn al-Haytham's Book of Optics (c. 1021) proved vision happens when light enters the eye, built the first camera obscura experiments, and insisted every claim be tested by repeatable experiment, centuries before Europe's scientific revolution.", detail: "Ibn al-Haytham · c. 965-1040 CE" },
  { category: "Mathematics", title: "Algorithm is a man's name", story: "The word algorithm comes from al-Khwarizmi, the Baghdad scholar whose 9th-century book on completion and balancing gave the world algebra (al-jabr). Every app you touch today runs on ideas that pass through his name.", detail: "House of Wisdom, Baghdad · 9th century" },
  { category: "Medicine", title: "Europe studied a Muslim's medical book for 600 years", story: "Ibn Sina's Canon of Medicine, finished in 1025, organized the world's medical knowledge so completely that European universities used it as a core textbook into the 17th century, and it described contagion long before germ theory.", detail: "Ibn Sina (Avicenna) · 980-1037 CE" },
  { category: "Preservation", title: "A book memorized by millions, letter-perfect", story: "The Qur'an is the only book on earth memorized cover to cover by millions of living people, in its original language, across every continent. This unbroken human chain of memory has guarded its text for over 14 centuries.", detail: "From revelation to today" },
  { category: "Travel", title: "He out-traveled Marco Polo three times over", story: "Ibn Battuta left Tangier in 1325 for hajj and kept going for 29 years: some 117,000 km across Africa, Arabia, India, Southeast Asia and China, leaving one of history's greatest travel accounts, the Rihla.", detail: "Ibn Battuta · 1304-1369 CE" },
  { category: "Coffee", title: "Your morning coffee has Sufi roots", story: "Coffee spread through the world from 15th-century Yemen, where Sufis in Mocha drank qahwa to stay awake for night devotion. From their gatherings it reached Makkah, Cairo, Istanbul, and eventually every café on earth.", detail: "Yemen · 15th century" },
  { category: "Surgery", title: "The surgeon whose instruments you would recognise", story: "Around the year 1000 in Cordoba, al-Zahrawi illustrated some two hundred surgical instruments: forceps, scalpels, specula, surgical needles. He also used catgut for internal stitches, having noticed the body absorbs it, which is why the thread inside a modern patient still does not need removing.", detail: "Al-Zahrawi · Cordoba, c. 1000 CE" },
  { category: "Astronomy", title: "A woman built the instruments that read the sky", story: "In tenth-century Aleppo, Mariam al-Ijliya made astrolabes, the finest navigation and timekeeping instruments of the age, and served the city's court as a celebrated maker. Her father had been an astrolabe maker before her; she was known for designs of unusual intricacy.", detail: "Aleppo · 10th century" },
  { category: "Libraries", title: "Timbuktu was a city of books", story: "At its height the scholars and families of Timbuktu kept hundreds of thousands of manuscripts on law, astronomy, medicine and faith: private libraries in the Sahara, passed down within families. Many survive today, still held by the descendants of the people who wrote and copied them.", detail: "Mali · 13th to 16th centuries" },
  { category: "Endowments", title: "The oldest running charities are waqf", story: "Islamic civilisation built the waqf: a permanent endowment whose income funds a hospital, a fountain, a school or a lodge for travellers, for as long as the endowment lasts. Some have served their communities without interruption for more than a thousand years.", detail: "Across the Muslim world" },
  { category: "Architecture", title: "Sinan raised three hundred works of light", story: "Mimar Sinan, chief Ottoman architect of the sixteenth century, built more than three hundred structures, among them the Suleymaniye and the Selimiye. His domes were engineered with such precision that they have stood through centuries of earthquakes in a region that has them often.", detail: "Istanbul and Edirne · 16th century" },
  { category: "Language", title: "Everyday English carries Arabic inside it", story: "Sugar, cotton, sofa, tariff, magazine, zenith, nadir, alchemy, alkali, algebra: dozens of ordinary English words travelled through Arabic scholarship and trade into Europe's languages. The words came with the things and the ideas they named.", detail: "A shared inheritance" },
  { category: "Flight", title: "The first recorded attempt at flight was in Cordoba", story: "In the ninth century Abbas ibn Firnas built a glider of silk and feathers and leapt from a height in Cordoba. He stayed in the air for a time before a rough landing that injured his back. A crater on the far side of the Moon now carries his name.", detail: "Abbas ibn Firnas · c. 810-887 CE" }
];

/* The lantern has a beautiful written fallback, and that fallback was in
   English only: a reader in Arabic met an English paragraph in an Arabic page
   whenever the AI could not be reached, which for weeks was every single day.
   The two languages that are fully carried have their own treasury. The rest
   fall back to English honestly rather than to machine mush. */
const TREASURY_I18N = {
  ar: [
  { category: "مؤسِّسون", title: "امرأة أسّست أقدم جامعة في العالم", story: "في سنة 859 للميلاد أنفقت فاطمة الفهرية، وهي امرأة مسلمة في فاس، ميراثها كله على بناء جامع القرويين، الذي تعترف اليونسكو وموسوعة غينيس بأنه أقدم جامعة مانحة للشهادات ما زالت تعمل على وجه الأرض. وهي تُدرّس إلى اليوم.", detail: "فاس، المغرب · 859م" },
  { category: "بصريات", title: "للمنهج العلمي أبٌ من البصرة", story: "أثبت ابن الهيثم في كتاب المناظر، نحو سنة 1021، أن الإبصار يقع حين يدخل الضوء إلى العين، وأجرى أوائل تجارب الغرفة المظلمة، وأصرّ على أن كل دعوى تُختبر بتجربة تُعاد، قبل الثورة العلمية في أوروبا بقرون.", detail: "ابن الهيثم · نحو 965-1040م" },
  { category: "رياضيات", title: "الخوارزمية اسم رجل", story: "كلمة algorithm جاءت من الخوارزمي، عالم بغداد الذي أعطى العالم الجبر في كتابه عن الجبر والمقابلة في القرن التاسع. وكل تطبيق تلمسه اليوم يقوم على أفكار تمر باسمه.", detail: "بيت الحكمة، بغداد · القرن التاسع" },
  { category: "طبّ", title: "درست أوروبا كتاب مسلم في الطب ستمئة سنة", story: "نظّم ابن سينا في القانون في الطب، الذي فرغ منه سنة 1025، معارف الطب في العالم تنظيمًا جعل الجامعات الأوروبية تتخذه كتابًا أساسيًا إلى القرن السابع عشر، وقد وصف العدوى قبل نظرية الجراثيم بزمن طويل.", detail: "ابن سينا · 980-1037م" },
  { category: "حفظ", title: "كتابٌ يحفظه الملايين حرفًا حرفًا", story: "القرآن هو الكتاب الوحيد على وجه الأرض الذي يحفظه من أوله إلى آخره ملايين الأحياء، بلغته التي نزل بها، في كل قارة. وهذه السلسلة البشرية المتصلة من الحفظ حرست نصّه أكثر من أربعة عشر قرنًا.", detail: "من زمن الوحي إلى اليوم" },
  { category: "رحلة", title: "طاف من الأرض ثلاثة أضعاف ما طافه ماركو بولو", story: "خرج ابن بطوطة من طنجة سنة 1325 قاصدًا الحج، ثم مضى تسعًا وعشرين سنة يمشي: نحو 117,000 كيلومتر عبر إفريقيا والجزيرة والهند وجنوب شرق آسيا والصين، وترك واحدة من أعظم كتب الرحلة في التاريخ، الرحلة.", detail: "ابن بطوطة · 1304-1369م" },
  { category: "قهوة", title: "لقهوة صباحك أصلٌ صوفي", story: "انتشرت القهوة في العالم من اليمن في القرن الخامس عشر، حيث كان الصوفية في المخا يشربون القهوة ليصحوا لقيام الليل. ومن مجالسهم بلغت مكة والقاهرة وإسطنبول، ثم كل مقهى على وجه الأرض.", detail: "اليمن · القرن الخامس عشر" },
    { category: "جراحة", title: "جرّاحٌ تعرف أدواته لو رأيتها اليوم", story: "نحو سنة 1000 للميلاد في قرطبة، رسم الزهراوي نحو مئتي آلة جراحية: الملاقط والمباضع والمناظير وإبر الخياطة. واستعمل خيط القِطْن الحيواني لخياطة الداخل بعد أن لاحظ أن الجسم يمتصّه، ولهذا لا يزال الخيط داخل المريض اليوم لا يحتاج إلى نزع.", detail: "الزهراوي · قرطبة، نحو 1000م" },
    { category: "فلك", title: "امرأة صنعت الآلات التي تقرأ السماء", story: "في حلب في القرن العاشر صنعت مريم الإسطرلابية الأسطرلابات، وهي أدق آلات الملاحة وضبط الوقت في زمانها، وعملت في بلاط المدينة صانعةً مشهورة. وكان أبوها صانع أسطرلابات قبلها، وعُرفت هي بتصاميم بالغة الدقة.", detail: "حلب · القرن العاشر" },
    { category: "مكتبات", title: "تمبكتو كانت مدينة كتب", story: "في أوج ازدهارها حفظ علماء تمبكتو وأهلها مئات الآلاف من المخطوطات في الفقه والفلك والطب والعقيدة: مكتبات خاصة في قلب الصحراء تتوارثها الأسر. وما زال كثير منها باقيًا اليوم عند أحفاد من كتبوها ونسخوها.", detail: "مالي · القرنان الثالث عشر والسادس عشر" },
    { category: "أوقاف", title: "أقدم الأعمال الخيرية الجارية هي الأوقاف", story: "أقامت الحضارة الإسلامية الوقف: حبسٌ دائم يُنفَق ريعه على مستشفى أو سبيل ماء أو مدرسة أو نُزُل للمسافرين، ما بقي الوقف. وبعضها خدم أهله دون انقطاع أكثر من ألف سنة.", detail: "في أنحاء العالم الإسلامي" },
    { category: "عمارة", title: "سنان رفع ثلاثمئة أثر من نور", story: "بنى معمار سنان، كبير معماريي الدولة العثمانية في القرن السادس عشر، أكثر من ثلاثمئة منشأة، منها السليمانية والسليمية. وقد هندس قبابه بدقة جعلتها تصمد قرونًا في أرض كثيرة الزلازل.", detail: "إسطنبول وأدرنة · القرن السادس عشر" },
    { category: "لغة", title: "الإنجليزية اليومية تحمل العربية في داخلها", story: "سكر، وقطن، وصوفا، وتعريفة، ومخزن، وسمت، ونظير، وكيمياء، وقلي، وجبر: عشرات من الكلمات الإنجليزية العادية عبرت من العلم والتجارة العربية إلى لغات أوروبا. جاءت الكلمات مع الأشياء والمعاني التي سمّتها.", detail: "ميراث مشترك" },
    { category: "طيران", title: "أول محاولة طيران مسجّلة كانت في قرطبة", story: "في القرن التاسع صنع عباس بن فرناس جناحين من حرير وريش وقفز من مرتفع في قرطبة، فبقي في الهواء مدة ثم هبط هبوطًا عنيفًا أصاب ظهره. واليوم تحمل فوهة على الوجه البعيد من القمر اسمه.", detail: "عباس بن فرناس · نحو 810-887م" }
  ],
  fr: [
  { category: "Fondatrices", title: "Une femme a fondé la plus ancienne université du monde", story: "En 859, Fatima al-Fihri, une musulmane de Fès, consacra tout son héritage à fonder al-Qarawiyyin, reconnue par l'UNESCO et le Guinness comme la plus ancienne université délivrant des diplômes encore en activité sur terre. Elle enseigne toujours.", detail: "Fès, Maroc · 859" },
  { category: "Optique", title: "La méthode scientifique a un père né à Bassora", story: "Le Livre de l'optique d'Ibn al-Haytham, vers 1021, démontra que la vision se produit lorsque la lumière entre dans l'œil, conduisit les premières expériences de chambre noire et exigea que toute affirmation soit éprouvée par l'expérience répétable, des siècles avant la révolution scientifique européenne.", detail: "Ibn al-Haytham · vers 965-1040" },
  { category: "Mathématiques", title: "Algorithme est un nom d'homme", story: "Le mot algorithme vient d'al-Khwarizmi, le savant de Bagdad dont le livre du 9e siècle sur la restauration et la comparaison donna au monde l'algèbre, al-jabr. Chaque application que vous touchez aujourd'hui repose sur des idées qui passent par son nom.", detail: "Maison de la sagesse, Bagdad · 9e siècle" },
  { category: "Médecine", title: "L'Europe a étudié le livre d'un musulman pendant six cents ans", story: "Le Canon de la médecine d'Ibn Sina, achevé en 1025, organisa le savoir médical du monde si complètement que les universités européennes en firent un manuel de base jusqu'au 17e siècle, et il y décrivait la contagion bien avant la théorie microbienne.", detail: "Ibn Sina, Avicenne · 980-1037" },
  { category: "Préservation", title: "Un livre su par cœur par des millions, à la lettre", story: "Le Coran est le seul livre au monde mémorisé d'un bout à l'autre par des millions de personnes vivantes, dans sa langue d'origine, sur tous les continents. Cette chaîne humaine ininterrompue garde son texte depuis plus de quatorze siècles.", detail: "De la révélation à aujourd'hui" },
  { category: "Voyage", title: "Il a parcouru trois fois plus de chemin que Marco Polo", story: "Ibn Battuta quitta Tanger en 1325 pour le hajj et continua vingt-neuf ans : quelque 117 000 km à travers l'Afrique, l'Arabie, l'Inde, l'Asie du Sud-Est et la Chine, laissant l'un des plus grands récits de voyage de l'histoire, la Rihla.", detail: "Ibn Battuta · 1304-1369" },
  { category: "Café", title: "Votre café du matin a des racines soufies", story: "Le café se répandit dans le monde depuis le Yémen du 15e siècle, où les soufis de Moka buvaient le qahwa pour veiller en prière la nuit. De leurs assemblées il gagna La Mecque, Le Caire, Istanbul, puis chaque café de la terre.", detail: "Yémen · 15e siècle" },
    { category: "Chirurgie", title: "Le chirurgien dont vous reconnaîtriez les instruments", story: "Vers l'an 1000 à Cordoue, al-Zahrawi illustra quelque deux cents instruments chirurgicaux : pinces, scalpels, spéculums, aiguilles à suture. Il employait aussi le catgut pour les sutures internes, ayant remarqué que le corps le résorbe, et c'est pourquoi le fil à l'intérieur d'un patient moderne n'a toujours pas besoin d'être retiré.", detail: "Al-Zahrawi · Cordoue, vers 1000" },
    { category: "Astronomie", title: "Une femme fabriquait les instruments qui lisent le ciel", story: "À Alep au 10e siècle, Mariam al-Ijliya fabriquait des astrolabes, les instruments de navigation et de mesure du temps les plus fins de son époque, et servit la cour de la ville comme artisane renommée. Son père avait été fabricant d'astrolabes avant elle ; on la connut pour des ouvrages d'une rare finesse.", detail: "Alep · 10e siècle" },
    { category: "Bibliothèques", title: "Tombouctou était une ville de livres", story: "À son apogée, les savants et les familles de Tombouctou conservaient des centaines de milliers de manuscrits de droit, d'astronomie, de médecine et de foi : des bibliothèques privées au cœur du Sahara, transmises de génération en génération. Beaucoup subsistent aujourd'hui, gardés par les descendants de ceux qui les écrivirent.", detail: "Mali · 13e au 16e siècle" },
    { category: "Fondations", title: "Les plus anciennes œuvres encore actives sont des waqf", story: "La civilisation islamique inventa le waqf : une fondation perpétuelle dont les revenus entretiennent un hôpital, une fontaine, une école ou un gîte pour voyageurs, aussi longtemps que dure la fondation. Certaines servent leur communauté sans interruption depuis plus de mille ans.", detail: "Dans tout le monde musulman" },
    { category: "Architecture", title: "Sinan éleva trois cents œuvres de lumière", story: "Mimar Sinan, premier architecte ottoman du 16e siècle, bâtit plus de trois cents édifices, dont la Suleymaniye et la Selimiye. Ses coupoles furent calculées avec une précision telle qu'elles ont traversé des siècles de tremblements de terre dans une région qui en connaît beaucoup.", detail: "Istanbul et Edirne · 16e siècle" },
    { category: "Langue", title: "Le français courant porte l'arabe en lui", story: "Sucre, coton, sofa, tarif, magasin, zénith, nadir, alchimie, alcali, algèbre : des dizaines de mots ordinaires ont voyagé depuis la science et le commerce arabes jusqu'aux langues d'Europe. Les mots sont venus avec les choses et les idées qu'ils nommaient.", detail: "Un héritage partagé" },
    { category: "Vol", title: "La première tentative de vol attestée eut lieu à Cordoue", story: "Au 9e siècle, Abbas ibn Firnas construisit un planeur de soie et de plumes et s'élança d'une hauteur à Cordoue. Il se maintint un temps dans les airs avant un atterrissage brutal qui lui blessa le dos. Un cratère de la face cachée de la Lune porte aujourd'hui son nom.", detail: "Abbas ibn Firnas · vers 810-887" }
  ]
};

const THEMES = [
  "a Muslim scientific or medical breakthrough, classical golden age",
  "a moment from the life of a companion of the Prophet ﷺ",
  "an on-this-day event of Islamic history near this date",
  "a wonder of Islamic architecture or a sacred place",
  "a modern discovery, invention or achievement by a Muslim",
  "the story behind a word, practice or tradition of the ummah",
  "libraries, books and the preservation of knowledge in Islam"
];

/* ---------- The Verse Lamp · curated refs, rotated by day ---------- */
const VERSES = ["2:286","2:255","94:5","13:28","65:3","3:139","39:53","2:152","21:107","24:35","93:5","2:216","29:69","8:2","17:24","31:18","49:13","55:13","67:2","103:1","2:186","16:97","33:70","25:63","28:24","12:87","20:25","40:60","42:19","57:4","76:9","4:110","3:159","23:1","62:9","59:22","112:1","1:5","18:10","19:96"];
const VERSE_FALLBACK = { ref: "2:286", reflection: "Allah does not burden a soul beyond what it can carry. Whatever today weighs, the verse is a scale in your favor: the load was measured by the One who made your shoulders. Read it slowly, then stand up again.", theme: "capacity" };

/* ---------- The Hidden Thread · whitelisted doors ---------- */

/* The Hidden Thread had exactly one written fallback, so with the lantern dark
   it showed the same Yusuf and Yunus pairing every day for weeks. A thread is
   supposed to be the thing you did not expect: here are twelve, reaching across
   prophets, companions, places, the names of Allah and the manners of the
   table, in the three languages the house carries fully. */
const THREADS = {
  en: [
  { text: "Yusuf was thrown into a well by his brothers; Yunus was swallowed by a whale after leaving his people. Two darknesses, two prisons no one could open, and one exit: honest words spoken to Allah from the bottom of them.", a: { label: "Yusuf · the well", href: "/prophets#yusuf" }, b: { label: "Yunus · the whale", href: "/prophets#yunus" } },
  { text: "Ibrahim was told to leave his wife and infant in a valley with no water, and he walked away without arguing. Hajar ran seven times between two hills looking for it. Every pilgrim since has run those same seven lengths, which means the Hajj preserves, forever, the panic of one mother.", a: { label: "Ibrahim · the valley", href: "/prophets#ibrahim" }, b: { label: "Sa'i · the seven", href: "/places" } },
  { text: "Musa was raised inside the house of the man who was killing children like him, fed by his own mother, who was paid a wage to nurse her son. The plan against him became the arrangement that saved him, and neither Pharaoh nor Musa's mother could see it at the time.", a: { label: "Musa · the palace", href: "/prophets#musa" }, b: { label: "The Qur'an on it", href: "/quran" } },
  { text: "Dawud was given iron that softened in his hands, and Sulayman after him was given the wind. Father and son, two kingdoms, and in both cases the miracle was not wealth but a material doing something no material does, so that neither could mistake the gift for his own strength.", a: { label: "Dawud · the iron", href: "/prophets#dawud" }, b: { label: "Sulayman · the wind", href: "/prophets#sulayman" } },
  { text: "Ayyub lost his body, his wealth and his children, and the whole of his complaint in the Qur'an is two lines long. Yaqub lost one son and wept until he went blind. Sabr is not the absence of grief: the Book records both men as patient, and only one of them was quiet.", a: { label: "Ayyub · the trial", href: "/prophets#ayyub" }, b: { label: "What sabr means", href: "/words" } },
  { text: "The first word revealed was Iqra, read, given to a man who could not read, in a cave he had climbed to be alone. The command arrived before the ability, which is the shape of almost every command that came after it.", a: { label: "Hira · the first word", href: "/prophets#muhammad" }, b: { label: "The Qur'an", href: "/quran" } },
  { text: "Bilal was tortured on the sand of Makkah for saying one word, ahad. Years later the same man stood on the roof of the Kaaba to call the adhan, and the city that had held the stone on his chest heard his voice from above it.", a: { label: "Bilal · one word", href: "/companions" }, b: { label: "Makkah", href: "/places" } },
  { text: "Zamzam appeared under the heel of an infant in a valley with no water, and it has not stopped since. Every pilgrim who drinks it is drinking from the answer to a mother's search, which is why the water is treated as an answer rather than a resource.", a: { label: "Zamzam", href: "/places" }, b: { label: "Hajar's search", href: "/prophets#ibrahim" } },
  { text: "Maryam was told to shake a dead palm trunk while in labour, alone. A woman at the limit of her strength was asked for one more effort, and the dates fell. The instruction is famous among mothers for a reason: the miracle waited for the shaking.", a: { label: "Maryam · the palm", href: "/prophets#isa" }, b: { label: "Rizq, provision", href: "/words" } },
  { text: "The Prophet ﷺ forbade drinking in one gulp and advised eating in thirds: a third food, a third water, a third breath. Both are manners rather than medicine, and both turn out to describe, almost exactly, how a stomach prefers to be filled.", a: { label: "Adab of the table", href: "/health" }, b: { label: "The Sunnah of eating", href: "/health" } },
  { text: "Nuh built a ship in a desert for decades while his people laughed, and the Qur'an records the mockery as carefully as it records the flood. The ridicule is preserved because the ridicule was the test, not the water.", a: { label: "Nuh · the ship", href: "/prophets#nuh" }, b: { label: "Sabr", href: "/words" } },
  { text: "Al-Latif, the Subtle, is the name for what moves so gently no one notices it working. It appears in the Qur'an beside Yusuf's rise and beside the rain that revives dead ground: two rescues so slow that nobody living through them could see a rescue at all.", a: { label: "Al-Latif", href: "/latif" }, b: { label: "Yusuf's rise", href: "/prophets#yusuf" } }
  ],
  ar: [
  { text: "أُلقي يوسف في الجبّ بأيدي إخوته، والتقم الحوتُ يونس بعد أن فارق قومه. ظلمتان، وسجنان لا يفتحهما أحد، ومخرج واحد: كلمات صادقة قيلت لله من القاع.", a: { label: "يوسف · الجبّ", href: "/prophets#yusuf" }, b: { label: "يونس · الحوت", href: "/prophets#yunus" } },
  { text: "أُمر إبراهيم أن يترك زوجه ورضيعها في وادٍ غير ذي زرع ولا ماء، فمضى ولم يجادل. وسعت هاجر سبعًا بين جبلين تطلب الماء. وكل حاجّ بعدها يسعى تلك الأشواط نفسها، فصار الحجّ حافظًا إلى الأبد لهرَع أمٍّ واحدة.", a: { label: "إبراهيم · الوادي", href: "/prophets#ibrahim" }, b: { label: "السّعي · سبعة أشواط", href: "/places" } },
  { text: "رُبِّي موسى في بيت الرجل الذي كان يقتل أمثاله من الصبيان، وأرضعته أمه وأُعطيت على ذلك أجرًا. فصار التدبير عليه هو التدبير الذي نجّاه، ولم يكن فرعون ولا أمّ موسى يريان ذلك حينها.", a: { label: "موسى · القصر", href: "/prophets#musa" }, b: { label: "ما قاله القرآن", href: "/quran" } },
  { text: "أُلين لداود الحديد في يده، وسُخِّرت لسليمان من بعده الريح. أبٌ وابن ومملكتان، والآية في الحالين ليست الغنى بل مادةٌ تفعل ما لا تفعله المواد، لئلا يحسب أحدهما العطية قوةً من نفسه.", a: { label: "داود · الحديد", href: "/prophets#dawud" }, b: { label: "سليمان · الريح", href: "/prophets#sulayman" } },
  { text: "فقد أيوب جسده وماله وولده، وشكواه كلها في القرآن سطران. وفقد يعقوب ابنًا واحدًا فبكى حتى ابيضّت عيناه. فليس الصبر عدم الحزن: الكتاب يشهد للرجلين بالصبر، وواحد منهما فقط كان صامتًا.", a: { label: "أيوب · البلاء", href: "/prophets#ayyub" }, b: { label: "معنى الصبر", href: "/words" } },
  { text: "أول ما نزل: اقرأ، وقيلت لرجل لا يقرأ، في غار صعد إليه ليخلو. جاء الأمر قبل القدرة، وتلك صورة أكثر ما جاء بعده من أمر.", a: { label: "حراء · أول كلمة", href: "/prophets#muhammad" }, b: { label: "القرآن", href: "/quran" } },
  { text: "عُذِّب بلال على رمضاء مكة من أجل كلمة واحدة: أحد. وبعد سنين وقف الرجل نفسه على ظهر الكعبة يؤذّن، فسمعت المدينة التي وضعت الصخرة على صدره صوته من فوقها.", a: { label: "بلال · كلمة واحدة", href: "/companions" }, b: { label: "مكة", href: "/places" } },
  { text: "نبع زمزم تحت عقب رضيع في وادٍ لا ماء فيه، وما انقطع منذئذ. وكل من شرب منه من الحجيج إنما يشرب من جواب سعي أمٍّ، ولذلك يُعامَل الماء جوابًا لا موردًا.", a: { label: "زمزم", href: "/places" }, b: { label: "سعي هاجر", href: "/prophets#ibrahim" } },
  { text: "أُمرت مريم أن تهزّ جذع نخلة يابسة وهي في المخاض وحدها. طُلب من امرأة بلغت آخر قوتها جهدٌ آخر، فتساقط الرطب. والوصية مشهورة عند الأمهات لسبب: المعجزة انتظرت الهزّ.", a: { label: "مريم · النخلة", href: "/prophets#isa" }, b: { label: "الرزق", href: "/words" } },
  { text: "نهى النبي ﷺ عن الشرب في نفَس واحد، وأرشد إلى ثلث للطعام وثلث للشراب وثلث للنفَس. وهما أدبٌ لا دواء، ومع ذلك يصفان وصفًا يكاد يكون دقيقًا كيف تحبّ المعدة أن تُملأ.", a: { label: "أدب المائدة", href: "/health" }, b: { label: "سنّة الأكل", href: "/health" } },
  { text: "بنى نوح سفينة في الصحراء عقودًا وقومه يسخرون، والقرآن يحفظ سخريتهم بمثل ما يحفظ الطوفان. حُفظ الاستهزاء لأن الاستهزاء كان الابتلاء، لا الماء.", a: { label: "نوح · السفينة", href: "/prophets#nuh" }, b: { label: "الصبر", href: "/words" } },
  { text: "اللطيف اسمٌ لما يعمل في رفق حتى لا يشعر به أحد. يأتي في القرآن عند رفعة يوسف وعند الغيث الذي يحيي الأرض بعد موتها: إنقاذان من البطء بحيث لا يرى من يعيشهما إنقاذًا أصلًا.", a: { label: "اللطيف", href: "/latif" }, b: { label: "رفعة يوسف", href: "/prophets#yusuf" } }
  ],
  fr: [
  { text: "Yusuf fut jeté dans un puits par ses frères ; Yunus fut avalé par la baleine après avoir quitté son peuple. Deux obscurités, deux prisons que nul ne pouvait ouvrir, et une seule issue : des mots sincères adressés à Allah depuis le fond.", a: { label: "Yusuf · le puits", href: "/prophets#yusuf" }, b: { label: "Yunus · la baleine", href: "/prophets#yunus" } },
  { text: "Ibrahim reçut l'ordre de laisser son épouse et son nourrisson dans une vallée sans eau, et il s'éloigna sans discuter. Hajar courut sept fois entre deux collines pour en chercher. Chaque pèlerin depuis parcourt ces mêmes sept trajets : le Hajj conserve à jamais l'affolement d'une seule mère.", a: { label: "Ibrahim · la vallée", href: "/prophets#ibrahim" }, b: { label: "Le sa'i · les sept", href: "/places" } },
  { text: "Musa fut élevé dans la maison de l'homme qui tuait les enfants comme lui, nourri par sa propre mère, payée pour allaiter son fils. Le plan contre lui devint l'arrangement qui le sauva, et ni Pharaon ni la mère de Musa ne pouvaient le voir alors.", a: { label: "Musa · le palais", href: "/prophets#musa" }, b: { label: "Ce qu'en dit le Coran", href: "/quran" } },
  { text: "Le fer s'adoucissait dans les mains de Dawud, et le vent fut soumis à Sulayman après lui. Un père, un fils, deux royaumes, et dans les deux cas le prodige n'était pas la richesse mais une matière faisant ce qu'aucune matière ne fait, pour qu'aucun des deux ne prenne le don pour sa propre force.", a: { label: "Dawud · le fer", href: "/prophets#dawud" }, b: { label: "Sulayman · le vent", href: "/prophets#sulayman" } },
  { text: "Ayyub perdit son corps, ses biens et ses enfants, et toute sa plainte dans le Coran tient en deux lignes. Yaqub perdit un fils et pleura jusqu'à en perdre la vue. La patience n'est pas l'absence de chagrin : le Livre atteste que les deux furent patients, et un seul fut silencieux.", a: { label: "Ayyub · l'épreuve", href: "/prophets#ayyub" }, b: { label: "Le sens du sabr", href: "/words" } },
  { text: "Le premier mot révélé fut Iqra, lis, donné à un homme qui ne savait pas lire, dans une grotte où il était monté pour être seul. L'ordre précéda la capacité, et c'est la forme de presque tous les ordres venus ensuite.", a: { label: "Hira · le premier mot", href: "/prophets#muhammad" }, b: { label: "Le Coran", href: "/quran" } },
  { text: "Bilal fut torturé sur le sable de La Mecque pour un seul mot : ahad. Des années plus tard, le même homme se tint sur le toit de la Kaaba pour appeler à la prière, et la ville qui avait posé la pierre sur sa poitrine entendit sa voix au-dessus d'elle.", a: { label: "Bilal · un seul mot", href: "/companions" }, b: { label: "La Mecque", href: "/places" } },
  { text: "Zamzam jaillit sous le talon d'un nourrisson dans une vallée sans eau, et n'a pas cessé depuis. Chaque pèlerin qui en boit boit la réponse à la quête d'une mère, et c'est pourquoi cette eau est traitée comme une réponse et non comme une ressource.", a: { label: "Zamzam", href: "/places" }, b: { label: "La quête de Hajar", href: "/prophets#ibrahim" } },
  { text: "Il fut dit à Maryam de secouer un tronc de palmier mort pendant qu'elle accouchait, seule. On demanda un effort de plus à une femme au bout de ses forces, et les dattes tombèrent. L'instruction est célèbre chez les mères pour une raison : le miracle a attendu la secousse.", a: { label: "Maryam · le palmier", href: "/prophets#isa" }, b: { label: "Le rizq", href: "/words" } },
  { text: "Le Prophète ﷺ interdit de boire d'un trait et conseilla de manger par tiers : un tiers de nourriture, un tiers d'eau, un tiers de souffle. Ce sont des manières et non une médecine, et pourtant elles décrivent presque exactement la façon dont un estomac préfère être rempli.", a: { label: "Les manières de table", href: "/health" }, b: { label: "La sunna du repas", href: "/health" } },
  { text: "Nuh construisit un navire dans le désert pendant des décennies tandis que son peuple riait, et le Coran conserve la moquerie aussi soigneusement que le déluge. La raillerie est préservée parce que la raillerie était l'épreuve, non l'eau.", a: { label: "Nuh · le navire", href: "/prophets#nuh" }, b: { label: "Le sabr", href: "/words" } },
  { text: "Al-Latif, le Subtil, est le nom de ce qui agit si doucement que nul ne le remarque. Il apparaît dans le Coran auprès de l'élévation de Yusuf et de la pluie qui ranime une terre morte : deux sauvetages si lents que personne les traversant n'y voyait un sauvetage.", a: { label: "Al-Latif", href: "/latif" }, b: { label: "L'élévation de Yusuf", href: "/prophets#yusuf" } }
  ]
};
function threadFallback(today, lang) {
  const t = THREADS[lang] || THREADS.en;
  return Object.assign({ date: today, lang: lang || "en", source: "treasury" }, t[dayIndexOf(today) % t.length]);
}

const DOORS = {
  quran: "/quran", prophets: "/prophets", musa: "/prophets#musa", yusuf: "/prophets#yusuf", nuh: "/prophets#nuh",
  ibrahim: "/prophets#ibrahim", yunus: "/prophets#yunus", isa: "/prophets#isa", muhammad: "/prophets#muhammad",
  ayyub: "/prophets#ayyub", sulayman: "/prophets#sulayman", dawud: "/prophets#dawud", maryamline: "/prophets#isa",
  companions: "/companions", characters: "/characters", places: "/places", words: "/words",
  health: "/health", theology: "/theology", latif: "/latif", begin: "/begin", kids: "/kids"
};

/* ---------- The Seeker's Question · curated, rotated ---------- */
const QUESTIONS = [
  "Why do Muslims pray five times a day?","What does the word Islam actually mean?","Why do Muslims fast in Ramadan?",
  "Who was Muhammad ﷺ, in one honest minute?","Is the Qur'an really unchanged?","What is the Kaaba and why face it?",
  "What does Allah mean, and is it the same God?","Why is Friday special to Muslims?","What happens in the five daily prayers?",
  "What is halal and why does it matter?","Do Muslims believe in Jesus?","What is zakat and who receives it?",
  "Why do some Muslim women wear hijab?","What is the Sunnah?","What does 'Allahu akbar' really mean?",
  "How does someone become a Muslim?","What do Muslims believe happens after death?","Why is Arabic so central to Islam?",
  "What is Laylat al-Qadr?","What are the five pillars, briefly?","Why no images of the prophets?",
  "What is a hadith and how is one trusted?","What is the difference between Sunni and Shia?","Is Islam only for Arabs?",
  "What is wudu and why wash before prayer?","What does jihad actually mean?","Why do Muslims say 'insha'Allah'?",
  "What is Hajj and why once in a lifetime?","How do Muslims view the Bible and Torah?","What is sadaqa jariyah?"
];
const QUESTION_FALLBACK = { q: "What does the word Islam actually mean?", a: "Islam comes from the Arabic root s-l-m, the same root as salam, peace. It means entering peace by surrendering to the One who made you: not defeat, but the relief of putting down a weight on the only shoulders that can carry everything. A Muslim is simply one who does that.", href: "/begin", room: "Begin the path" };

const FRIDAY_FALLBACK = { text: "Jumu'ah Mubarak. The Prophet ﷺ called Friday the best day the sun rises upon. Wash, wear your good clothes, send prayers upon him ﷺ abundantly, and give something, even small. There is an hour in this day when du'a is not refused; spend it like treasure.", kahf: true };

/* ---------- shared plumbing ---------- */
const cache = new Map();
function remember(k, v) { cache.set(k, v); if (cache.size > 96) cache.delete(cache.keys().next().value); return v; }
function dayIndexOf(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
}
const clean = x => String(x || "").replace(/—|–/g, "·").trim();

/* The Codex speaks 21 languages, and until now its daily light spoke one.
   A reader who switched to Arabic met an English paragraph sitting inside an
   otherwise Arabic page. The lantern is simply told which language to write
   in, and each language keeps its own copy of the day, so the cost is one
   generation per language per day rather than one per reader. */
const LANGS = { en:"English", ar:"Arabic", fr:"French", es:"Spanish", de:"German",
  ru:"Russian", tr:"Turkish", ur:"Urdu", hi:"Hindi", bn:"Bengali", id:"Indonesian",
  fa:"Persian", prs:"Dari", pa:"Punjabi", ha:"Hausa", ps:"Pashto", so:"Somali",
  ku:"Kurdish", sw:"Swahili", zh:"Chinese", ja:"Japanese", ko:"Korean" };
function langOf(req) {
  const raw = String((req.query && req.query.lang) || "").slice(0, 3).toLowerCase();
  return LANGS[raw] ? raw : "en";
}
function inLanguage(code) {
  if (code === "en") return "";
  return "\nWrite every value in " + LANGS[code] + ", in the natural register a "
    + LANGS[code] + " reader expects from a reverent Islamic library. Proper names take "
    + "their standard " + LANGS[code] + " form. Numbers and dates stay in Western digits.";
}
/* One shared abort for the whole chain was this file's quiet bug: the first
   few names were dead, they spent the 6.5 seconds between them, and the model
   that would have answered was never reached. Each attempt now carries its own
   patience, and the walk stops when the function's own budget runs out. */
async function lantern(system, user, maxTokens) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw 0;
  const chain = await liveChain();
  const deadline = Date.now() + 20000;
  for (const model of chain.slice(0, 4)) {
    if (Date.now() > deadline) break;
    const ac = new AbortController();
    const tt = setTimeout(() => ac.abort(), Math.min(9000, Math.max(1500, deadline - Date.now())));
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", { signal: ac.signal,
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "HTTP-Referer": "https://noorcodex.com", "X-Title": "NOOR illuminations" },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.4, messages: [{ role: "system", content: system }, { role: "user", content: user }] })
      });
      if (!r.ok) continue;
      const j = await r.json();
      const raw = (((j.choices || [])[0] || {}).message || {}).content || "";
      let p = null;
      try { p = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch {} } }
      if (p) return p;
    } catch {} finally { clearTimeout(tt); }
  }
  throw 0;
}
const BASE_RULES = "Accuracy is sacred: well-established facts and mainstream Sunni understanding only; never invent dates, quotes, hadith or verses; no rulings, no fatwas. Warm, vivid, plain language. Never use the em dash character; use commas or · instead. Reply with JSON only.";

/* ---------- kinds ---------- */
/* Today's Light no longer comes from the AI.
   ---------------------------------------------------------------------------
   It comes from a library of hundreds of written, validated cards, and the
   Lantern is moved to the job it is actually good at: choosing which one fits
   today and checking it before it is shown. See api/_lights.js for why.

   The old behaviour, an AI writing a historical claim fresh every morning with
   nobody checking it, is exactly the thing this site is not allowed to do. */
async function kindLight(today, want, lang, host) {
  const picked = await chooseLight(host, want, { useLantern: true });
  if (picked) {
    return { date: want, lang: lang || "en", source: picked.source,
             category: clean(picked.category).slice(0, 26),
             title: clean(picked.title).slice(0, 96),
             story: clean(picked.story).slice(0, 1200),
             detail: clean(picked.detail).slice(0, 64),
             id: picked.id, why: picked.why, lvl: picked.lvl, src: picked.src,
             hijri: picked.hijri };
  }
  return lightFallback(want, lang);
}
function lightFallback(want, lang) {
  const t = (lang && TREASURY_I18N[lang]) || TREASURY;
  const f = t[dayIndexOf(want) % t.length];
  return Object.assign({ date: want, lang: lang || "en", source: "treasury" }, f);
}
async function kindVerse(today) {
  const ref = VERSES[dayIndexOf(today) % VERSES.length];
  try {
    const p = await lantern(
      ["You write the daily Verse Lamp for NOOR Codex of Light. The verse is Qur'an " + ref + ".",
       'JSON exactly: {"reflection":"...","theme":"one or two words"}',
       "reflection: 55 to 85 words on this verse's meaning for an ordinary person's day, grounded in its classical context. Do not paraphrase the whole verse; illuminate it. Address the reader gently as you.",
       BASE_RULES].join("\n"),
      "The reflection for Qur'an " + ref + " on " + today + ".", 260);
    if (!p.reflection) throw 0;
    return { date: today, ref, reflection: clean(p.reflection).slice(0, 600), theme: clean(p.theme).slice(0, 24), source: "lantern" };
  } catch { return Object.assign({ date: today, source: "treasury" }, VERSE_FALLBACK, { ref }); }
}
async function kindThread(today, lang) {
  try {
    const doors = Object.keys(DOORS).join(", ");
    const p = await lantern(
      ["You write the daily Hidden Thread for NOOR Codex of Light: one surprising, TRUE connection between two things in the library (prophets' stories, companions, places, words, practices).",
       'JSON exactly: {"text":"...","aLabel":"...","aDoor":"...","bLabel":"...","bDoor":"..."}',
       "text: 40 to 70 words revealing the connection, ending with a note of wonder. aDoor and bDoor MUST each be one of exactly these door names: " + doors + ".",
       "aLabel/bLabel: 2 to 4 words naming each side.",
       "Range across the whole of Islam: the prophets, the companions, the sacred places, the names of Allah, the words of the Path, worship, the manners of ordinary life, the golden age of science, and the signs of the Hour. Do not lean on the same few stories.",
       BASE_RULES + inLanguage(lang || "en")].join("\n"),
      "The thread for " + today + ". Choose a pairing unlikely to repeat often.", 340);
    const a = DOORS[String(p.aDoor || "").toLowerCase()], b = DOORS[String(p.bDoor || "").toLowerCase()];
    if (!p.text || !a || !b) throw 0;
    return { date: today, text: clean(p.text).slice(0, 500), a: { label: clean(p.aLabel).slice(0, 40) || "Open", href: a }, b: { label: clean(p.bLabel).slice(0, 40) || "Open", href: b }, source: "lantern" };
  } catch { return threadFallback(today, lang); }
}
async function kindQuestion(today) {
  const q = QUESTIONS[dayIndexOf(today) % QUESTIONS.length];
  try {
    const doors = Object.keys(DOORS).join(", ");
    const p = await lantern(
      ["You answer the daily Seeker's Question for NOOR Codex of Light. Today's question: " + q,
       'JSON exactly: {"a":"...","door":"...","room":"..."}',
       "a: 70 to 110 words, honest, warm, precise, for someone who may not be Muslim. Cite Qur'an by number only when certain. door MUST be one of: " + doors + ". room: 2 to 4 words naming that door for the reader.",
       BASE_RULES].join("\n"),
      "Answer for " + today + ".", 320);
    const href = DOORS[String(p.door || "").toLowerCase()];
    if (!p.a || !href) throw 0;
    return { date: today, q, a: clean(p.a).slice(0, 800), href, room: clean(p.room).slice(0, 40) || "Explore", source: "lantern" };
  } catch { return Object.assign({ date: today, source: "treasury" }, QUESTION_FALLBACK, { q: QUESTION_FALLBACK.q }); }
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + "-W" + String(Math.ceil((((t - y0) / 86400000) + 1) / 7)).padStart(2, "0");
}
async function kindFriday(weekKey) {
  try {
    const p = await lantern(
      ["You write the weekly Friday Light for NOOR Codex of Light, shown on Jumu'ah.",
       'JSON exactly: {"text":"..."}',
       "text: 60 to 90 words of Jumu'ah encouragement rooted in authentic sunnah of Friday (ghusl, salawat upon the Prophet ﷺ, Surah al-Kahf, the hour of answered du'a, charity). Begin with Jumu'ah Mubarak.",
       BASE_RULES].join("\n"),
      "Friday Light for week " + weekKey + ".", 240);
    if (!p.text) throw 0;
    return { week: weekKey, text: clean(p.text).slice(0, 700), kahf: true, source: "lantern" };
  } catch { return Object.assign({ week: weekKey, source: "treasury" }, FRIDAY_FALLBACK); }
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  const kind = String((req.query && req.query.kind) || "light");
  const today = new Date().toISOString().slice(0, 10);

  if (kind === "light") {
    let want = String((req.query && req.query.date) || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(want)) want = today;
    const age = Math.floor((Date.parse(today) - Date.parse(want)) / 86400000);
    if (!(age >= 0 && age <= 30)) want = today;
    const lang = langOf(req);
    res.setHeader("Vary", "Accept-Language");
    res.setHeader("Cache-Control", want === today ? "public, s-maxage=86400, stale-while-revalidate=172800" : "public, s-maxage=2592000, stale-while-revalidate=2592000");
    const ck = "light:" + lang + ":" + want;
    const kk = "nl:" + (lang === "en" ? "" : lang + ":") + want;
    if (cache.has(ck)) return res.status(200).json(cache.get(ck));
    /* past days never wake the AI: they come from the store's memory of
       what actually shone that day, or from the treasury, instantly. */
    if (want !== today) {
      if (kvReady()) {
        try {
          const hit = (await kv([["GET", kk]]))[0];
          if (hit) return res.status(200).json(remember(ck, JSON.parse(hit)));
        } catch {}
      }
      return res.status(200).json(remember(ck, lightFallback(want, lang)));
    }
    /* Today, asked once. Whoever arrives first (usually the nightly warm run)
       pays for the generation; everyone else on earth reads what was stored. */
    if (kvReady()) {
      try {
        const hit = (await kv([["GET", kk]]))[0];
        if (hit) return res.status(200).json(remember(ck, JSON.parse(hit)));
      } catch {}
    }
    try {
      const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
      const lit = await kindLight(today, want, lang, host);
      if (kvReady()) { kv([["SET", kk, JSON.stringify(lit)], ["EXPIRE", kk, "2764800"]]).catch(() => {}); }
      return res.status(200).json(remember(ck, lit));
    }
    catch { return res.status(200).json(remember(ck, lightFallback(want, lang))); }
  }

  if (kind === "friday") {
    const wk = isoWeek(new Date());
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=172800");
    const ck = "friday:" + wk;
    if (cache.has(ck)) return res.status(200).json(cache.get(ck));
    return res.status(200).json(remember(ck, await kindFriday(wk)));
  }

  const makers = { verse: kindVerse, thread: kindThread, question: kindQuestion };
  const make = makers[kind];
  if (!make) return res.status(400).json({ error: "unknown kind" });
  const lang2 = langOf(req);
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=172800");
  const ck = kind + ":" + lang2 + ":" + today;
  if (cache.has(ck)) return res.status(200).json(cache.get(ck));
  return res.status(200).json(remember(ck, await make(today, lang2)));
}
