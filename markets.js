/* NOOR Guardian markets, the world, broken into lamps.
   One Guardian per market. A reader is resolved to exactly ONE market
   on-device (domain → metro timezone → country → language → worldwide),
   so the Codex never shows more than one seal to anyone.
   Detection uses ONLY: the hostname, the device timezone, the browser
   language tags. Nothing is sent anywhere. Zero tracking, as chartered.

   tier prices (USD/month): 0=$299 · 1=$199 · 2=$99 · 3=$49 · 4=$19
   To add a region: add one line. To change a tier: change one digit. */
window.NOOR_MARKETS = {
  version: 2,
  tierPrices: { 0: 299, 1: 199, 2: 99, 3: 49, 4: 19 },
  /* kind: metro (timezone match) · country (language-region / domain) · lang (language) · global */
  list: [
    /* ---------- domains (strongest signal) ---------- */
    { id:"CA",       label:"Canada",                   tier:1, kind:"country", match:{ domains:["noorcodex.ca","www.noorcodex.ca"], regions:["CA"] } },

    /* ---------- Canada metros ---------- */
    { id:"CA-TOR",   label:"Toronto & Eastern Canada", tier:1, kind:"metro", match:{ tz:["America/Toronto","America/Iqaluit"] } },
    { id:"CA-QC-FR", label:"Québec (français)",        tier:1, kind:"metro", match:{ langs:["fr-CA"] } },
    { id:"CA-VAN",   label:"Vancouver & BC",           tier:1, kind:"metro", match:{ tz:["America/Vancouver"] } },
    { id:"CA-AB",    label:"Alberta",                  tier:1, kind:"metro", match:{ tz:["America/Edmonton"] } },
    { id:"CA-PR",    label:"Canadian Prairies",        tier:1, kind:"metro", match:{ tz:["America/Winnipeg","America/Regina"] } },
    { id:"CA-ATL",   label:"Atlantic Canada",          tier:1, kind:"metro", match:{ tz:["America/Halifax","America/Moncton","America/St_Johns","America/Goose_Bay"] } },

    /* ---------- United States ---------- */
    { id:"US-EAST",  label:"US East",                  tier:1, kind:"metro", match:{ tz:["America/New_York","America/Detroit"] } },
    { id:"US-CEN",   label:"US Central",               tier:1, kind:"metro", match:{ tz:["America/Chicago"] } },
    { id:"US-MTN",   label:"US Mountain",              tier:1, kind:"metro", match:{ tz:["America/Denver","America/Boise","America/Phoenix"] } },
    { id:"US-WEST",  label:"US West",                  tier:1, kind:"metro", match:{ tz:["America/Los_Angeles"] } },
    { id:"US-AKHI",  label:"Alaska & Hawaii",          tier:2, kind:"metro", match:{ tz:["America/Anchorage","Pacific/Honolulu"] } },
    { id:"US",       label:"United States",            tier:1, kind:"country", match:{ regions:["US"] } },

    /* ---------- Europe west ---------- */
    { id:"UK",       label:"United Kingdom",           tier:1, kind:"metro", match:{ tz:["Europe/London"], regions:["GB"] } },
    { id:"IE",       label:"Ireland",                  tier:1, kind:"metro", match:{ tz:["Europe/Dublin"], regions:["IE"] } },
    { id:"FR",       label:"France",                   tier:1, kind:"metro", match:{ tz:["Europe/Paris"], regions:["FR"] } },
    { id:"DE",       label:"Germany",                  tier:1, kind:"metro", match:{ tz:["Europe/Berlin"], regions:["DE"] } },
    { id:"NL",       label:"Netherlands",              tier:1, kind:"metro", match:{ tz:["Europe/Amsterdam"], regions:["NL"] } },
    { id:"BE",       label:"Belgium",                  tier:1, kind:"metro", match:{ tz:["Europe/Brussels"], regions:["BE"] } },
    { id:"CH",       label:"Switzerland",              tier:1, kind:"metro", match:{ tz:["Europe/Zurich"], regions:["CH"] } },
    { id:"AT",       label:"Austria",                  tier:1, kind:"metro", match:{ tz:["Europe/Vienna"], regions:["AT"] } },
    { id:"SE",       label:"Sweden",                   tier:1, kind:"metro", match:{ tz:["Europe/Stockholm"], regions:["SE"] } },
    { id:"NO",       label:"Norway",                   tier:1, kind:"metro", match:{ tz:["Europe/Oslo"], regions:["NO"] } },
    { id:"DK",       label:"Denmark",                  tier:1, kind:"metro", match:{ tz:["Europe/Copenhagen"], regions:["DK"] } },
    { id:"ES",       label:"Spain",                    tier:2, kind:"metro", match:{ tz:["Europe/Madrid"], regions:["ES"] } },
    { id:"IT",       label:"Italy",                    tier:2, kind:"metro", match:{ tz:["Europe/Rome"], regions:["IT"] } },
    { id:"PT",       label:"Portugal",                 tier:2, kind:"metro", match:{ tz:["Europe/Lisbon"], regions:["PT"] } },
    { id:"PL",       label:"Poland",                   tier:2, kind:"metro", match:{ tz:["Europe/Warsaw"], regions:["PL"] } },
    { id:"BALKAN",   label:"Balkans & SE Europe",      tier:3, kind:"metro", match:{ tz:["Europe/Sarajevo","Europe/Belgrade","Europe/Skopje","Europe/Tirane","Europe/Zagreb","Europe/Sofia","Europe/Bucharest","Europe/Athens"] } },
    { id:"UA",       label:"Ukraine",                  tier:3, kind:"metro", match:{ tz:["Europe/Kiev","Europe/Kyiv"], regions:["UA"] } },
    { id:"RU",       label:"Russia & Caucasus",        tier:3, kind:"metro", match:{ tz:["Europe/Moscow","Europe/Samara","Asia/Yekaterinburg"], regions:["RU"] } },

    /* ---------- Gulf & Middle East ---------- */
    { id:"AE",       label:"United Arab Emirates",     tier:1, kind:"metro", match:{ tz:["Asia/Dubai"], regions:["AE"] } },
    { id:"SA",       label:"Saudi Arabia",             tier:1, kind:"metro", match:{ tz:["Asia/Riyadh"], regions:["SA"] } },
    { id:"QA",       label:"Qatar",                    tier:1, kind:"metro", match:{ tz:["Asia/Qatar"], regions:["QA"] } },
    { id:"KW",       label:"Kuwait",                   tier:1, kind:"metro", match:{ tz:["Asia/Kuwait"], regions:["KW"] } },
    { id:"BH",       label:"Bahrain",                  tier:1, kind:"metro", match:{ tz:["Asia/Bahrain"], regions:["BH"] } },
    { id:"OM",       label:"Oman",                     tier:2, kind:"metro", match:{ tz:["Asia/Muscat"], regions:["OM"] } },
    { id:"JO",       label:"Jordan",                   tier:3, kind:"metro", match:{ tz:["Asia/Amman"], regions:["JO"] } },
    { id:"LB",       label:"Lebanon",                  tier:3, kind:"metro", match:{ tz:["Asia/Beirut"], regions:["LB"] } },
    { id:"IQ",       label:"Iraq",                     tier:3, kind:"metro", match:{ tz:["Asia/Baghdad"], regions:["IQ"] } },
    { id:"SY",       label:"Syria",                    tier:4, kind:"metro", match:{ tz:["Asia/Damascus"], regions:["SY"] } },
    { id:"YE",       label:"Yemen",                    tier:4, kind:"metro", match:{ tz:["Asia/Aden"], regions:["YE"] } },
    { id:"IR",       label:"Iran",                     tier:3, kind:"metro", match:{ tz:["Asia/Tehran"], regions:["IR"] } },
    { id:"IL-PS",    label:"Palestine",                tier:3, kind:"metro", match:{ tz:["Asia/Jerusalem","Asia/Gaza","Asia/Hebron"], regions:["PS"] } },
    { id:"TR",       label:"Türkiye",                  tier:2, kind:"metro", match:{ tz:["Europe/Istanbul"], regions:["TR"] } },

    /* ---------- Africa ---------- */
    { id:"EG",       label:"Egypt",                    tier:3, kind:"metro", match:{ tz:["Africa/Cairo"], regions:["EG"] } },
    { id:"MA",       label:"Morocco",                  tier:3, kind:"metro", match:{ tz:["Africa/Casablanca"], regions:["MA"] } },
    { id:"DZ",       label:"Algeria",                  tier:3, kind:"metro", match:{ tz:["Africa/Algiers"], regions:["DZ"] } },
    { id:"TN",       label:"Tunisia",                  tier:3, kind:"metro", match:{ tz:["Africa/Tunis"], regions:["TN"] } },
    { id:"LY",       label:"Libya",                    tier:3, kind:"metro", match:{ tz:["Africa/Tripoli"], regions:["LY"] } },
    { id:"SD",       label:"Sudan",                    tier:4, kind:"metro", match:{ tz:["Africa/Khartoum"], regions:["SD"] } },
    { id:"NG",       label:"Nigeria",                  tier:3, kind:"metro", match:{ tz:["Africa/Lagos"], regions:["NG"] } },
    { id:"GH",       label:"Ghana & West Africa",      tier:3, kind:"metro", match:{ tz:["Africa/Accra","Africa/Abidjan","Africa/Dakar","Africa/Bamako","Africa/Conakry"] } },
    { id:"KE",       label:"Kenya & East Africa",      tier:3, kind:"metro", match:{ tz:["Africa/Nairobi","Africa/Dar_es_Salaam","Africa/Kampala","Africa/Addis_Ababa","Africa/Mogadishu"] } },
    { id:"ZA",       label:"South Africa",             tier:2, kind:"metro", match:{ tz:["Africa/Johannesburg"], regions:["ZA"] } },

    /* ---------- South & Central Asia ---------- */
    { id:"PK",       label:"Pakistan",                 tier:3, kind:"metro", match:{ tz:["Asia/Karachi"], regions:["PK"] } },
    { id:"IN",       label:"India",                    tier:3, kind:"metro", match:{ tz:["Asia/Kolkata","Asia/Calcutta"], regions:["IN"] } },
    { id:"BD",       label:"Bangladesh",               tier:3, kind:"metro", match:{ tz:["Asia/Dhaka"], regions:["BD"] } },
    { id:"LK",       label:"Sri Lanka",                tier:3, kind:"metro", match:{ tz:["Asia/Colombo"], regions:["LK"] } },
    { id:"NP",       label:"Nepal",                    tier:4, kind:"metro", match:{ tz:["Asia/Kathmandu"], regions:["NP"] } },
    { id:"AF",       label:"Afghanistan",              tier:4, kind:"metro", match:{ tz:["Asia/Kabul"], regions:["AF"] } },
    { id:"MV",       label:"Maldives",                 tier:3, kind:"metro", match:{ tz:["Indian/Maldives"], regions:["MV"] } },
    { id:"KZ",       label:"Kazakhstan & Central Asia", tier:3, kind:"metro", match:{ tz:["Asia/Almaty","Asia/Tashkent","Asia/Bishkek","Asia/Dushanbe","Asia/Ashgabat"] } },
    { id:"AZ",       label:"Azerbaijan",               tier:3, kind:"metro", match:{ tz:["Asia/Baku"], regions:["AZ"] } },

    /* ---------- East & Southeast Asia · Oceania ---------- */
    { id:"ID",       label:"Indonesia",                tier:3, kind:"metro", match:{ tz:["Asia/Jakarta","Asia/Makassar","Asia/Jayapura"], regions:["ID"] } },
    { id:"MY",       label:"Malaysia",                 tier:2, kind:"metro", match:{ tz:["Asia/Kuala_Lumpur","Asia/Kuching"], regions:["MY"] } },
    { id:"SG",       label:"Singapore",                tier:1, kind:"metro", match:{ tz:["Asia/Singapore"], regions:["SG"] } },
    { id:"BN",       label:"Brunei",                   tier:2, kind:"metro", match:{ tz:["Asia/Brunei"], regions:["BN"] } },
    { id:"PH",       label:"Philippines",              tier:3, kind:"metro", match:{ tz:["Asia/Manila"], regions:["PH"] } },
    { id:"MM",       label:"Myanmar",                  tier:4, kind:"metro", match:{ tz:["Asia/Yangon"], regions:["MM"] } },
    { id:"JP",       label:"Japan",                    tier:1, kind:"metro", match:{ tz:["Asia/Tokyo"], regions:["JP"] } },
    { id:"KR",       label:"South Korea",              tier:2, kind:"metro", match:{ tz:["Asia/Seoul"], regions:["KR"] } },
    { id:"CN-HK",    label:"China & Hong Kong",        tier:2, kind:"metro", match:{ tz:["Asia/Shanghai","Asia/Hong_Kong"], regions:["CN","HK"] } },
    { id:"AU-SYD",   label:"Sydney & NSW",             tier:1, kind:"metro", match:{ tz:["Australia/Sydney"] } },
    { id:"AU-MEL",   label:"Melbourne & Victoria",     tier:1, kind:"metro", match:{ tz:["Australia/Melbourne","Australia/Hobart"] } },
    { id:"AU-BRI",   label:"Brisbane & Queensland",    tier:1, kind:"metro", match:{ tz:["Australia/Brisbane"] } },
    { id:"AU-PER",   label:"Perth & WA",               tier:1, kind:"metro", match:{ tz:["Australia/Perth","Australia/Adelaide","Australia/Darwin"] } },
    { id:"AU",       label:"Australia",                tier:1, kind:"country", match:{ regions:["AU"] } },
    { id:"NZ",       label:"New Zealand",              tier:1, kind:"metro", match:{ tz:["Pacific/Auckland"], regions:["NZ"] } },

    /* ---------- Americas south ---------- */
    { id:"MX",       label:"Mexico",                   tier:2, kind:"metro", match:{ tz:["America/Mexico_City","America/Monterrey","America/Tijuana"], regions:["MX"] } },
    { id:"BR",       label:"Brazil",                   tier:2, kind:"metro", match:{ tz:["America/Sao_Paulo","America/Bahia","America/Fortaleza","America/Manaus"], regions:["BR"] } },
    { id:"AR-CL",    label:"Argentina & Chile",        tier:2, kind:"metro", match:{ tz:["America/Argentina/Buenos_Aires","America/Santiago"], regions:["AR","CL"] } },
    { id:"CO-PE",    label:"Andes (CO·PE·EC·BO)",      tier:3, kind:"metro", match:{ tz:["America/Bogota","America/Lima","America/Guayaquil","America/La_Paz"] } },
    { id:"CARIB",    label:"Caribbean",                tier:3, kind:"metro", match:{ tz:["America/Port_of_Spain","America/Jamaica","America/Santo_Domingo","America/Barbados","America/Guyana","America/Paramaribo"] } },

    /* ---------- language communities (fallback layer) ---------- */
    { id:"L-AR",     label:"Arabic-speaking readers",  tier:2, kind:"lang", match:{ langs:["ar"] } },
    { id:"L-FR",     label:"French-speaking readers",  tier:2, kind:"lang", match:{ langs:["fr"] } },
    { id:"L-UR",     label:"Urdu-speaking readers",    tier:3, kind:"lang", match:{ langs:["ur"] } },
    { id:"L-TR",     label:"Turkish-speaking readers", tier:3, kind:"lang", match:{ langs:["tr"] } },
    { id:"L-ID",     label:"Indonesian & Malay readers",tier:3, kind:"lang", match:{ langs:["id","ms"] } },
    { id:"L-BN",     label:"Bengali-speaking readers", tier:3, kind:"lang", match:{ langs:["bn"] } },
    { id:"L-FA",     label:"Persian-speaking readers", tier:3, kind:"lang", match:{ langs:["fa"] } },
    { id:"L-ES",     label:"Spanish-speaking readers", tier:3, kind:"lang", match:{ langs:["es"] } },

    /* ---------- the one worldwide lamp ---------- */
    { id:"GLOBAL",   label:"Worldwide",                tier:0, kind:"global", match:{ catchAll:true } }
  ]
};

/* ---- local-currency display (mirrors the Stripe currency_options) ---- */
window.NOOR_MARKETS.currencyOf = {
  CA:"cad","CA-TOR":"cad","CA-QC-FR":"cad","CA-VAN":"cad","CA-AB":"cad","CA-PR":"cad","CA-ATL":"cad",
  UK:"gbp", IE:"eur",FR:"eur",DE:"eur",NL:"eur",BE:"eur",AT:"eur",ES:"eur",IT:"eur",PT:"eur","L-FR":"eur",
  "AU-SYD":"aud","AU-MEL":"aud","AU-BRI":"aud","AU-PER":"aud",AU:"aud",
  AE:"aed",SA:"sar",QA:"qar",SG:"sgd",MY:"myr",TR:"try",EG:"egp",MA:"mad",PK:"pkr",IN:"inr",ID:"idr",NG:"ngn"
};
window.NOOR_MARKETS.localPrices = {
  cad:{0:415,1:275,2:137,3:68,4:26},  gbp:{0:235,1:155,2:78,3:38,4:15},
  eur:{0:279,1:185,2:92,3:46,4:18},   aud:{0:449,1:299,2:149,3:74,4:29},
  aed:{0:1099,1:730,2:365,3:180,4:70}, sar:{0:1120,1:749,2:375,3:185,4:71},
  qar:{0:1089,1:725,2:360,3:178,4:69}, sgd:{0:399,1:265,2:132,3:65,4:25},
  myr:{0:1320,1:880,2:435,3:215,4:84}, try:{0:12500,1:8400,2:4200,3:2060,4:800},
  egp:{0:14900,1:9950,2:4950,3:2450,4:950}, mad:{0:2930,1:1950,2:970,3:480,4:186},
  pkr:{0:83500,1:55900,2:27700,3:13700,4:5300}, inr:{0:25000,1:16700,2:8300,3:4100,4:1600},
  idr:{0:4790000,1:3190000,2:1590000,3:785000,4:305000}, ngn:{0:465000,1:309000,2:154000,3:76000,4:29500}
};
window.NOOR_MARKETS.curSymbol = { cad:"C$", gbp:"£", eur:"€", aud:"A$", aed:"AED ", sar:"SAR ", qar:"QAR ", sgd:"S$", myr:"RM ", try:"₺", egp:"E£", mad:"MAD ", pkr:"₨", inr:"₹", idr:"Rp ", ngn:"₦" };
