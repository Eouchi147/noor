/* ================= The Madrasa of Light · the living curriculum =================
   Six tracks, twenty-eight lessons, every claim sourced. Free for every
   person forever; organizations embed it under license (/license).
   Card types: read (h,p) · letters (set) · pairs (rows) · steps (list) ·
   ayah (ref, ar, en) · tip (p). Quizzes pass at 70%. */
window.NOOR_CURRICULUM = {
tracks: [

/* ============ TRACK 1 · READING ARABIC ============ */
{ id:"huruf", icon:"nib", ar:"الْقِرَاءَة", name:"Reading Arabic",
  stage:"Garden → Workshop", color:"#C9A227",
  desc:"From zero to reading the Bismillah with your own eyes: the 28 letters, the vowel marks, and your first ayah.",
  lessons:[

{ id:"h1", name:"Letters I · the first seven", mins:8,
  cards:[
   {t:"read", h:"Twenty-eight keys", p:"Arabic reads right to left, and its whole world is written with 28 letters. You will meet them seven at a time. Do not rush: greet each one, say its sound out loud, and it will stay with you."},
   {t:"letters", set:[["ا","Alif","a long open aa, as in far"],["ب","Bā’","b as in book · one dot below"],["ت","Tā’","t as in tea · two dots above"],["ث","Thā’","th as in three · three dots above"],["ج","Jīm","j as in jam"],["ح","Ḥā’","a deep breathy h from the throat"],["خ","Khā’","kh, like the ch in Scottish loch"]]},
   {t:"tip", p:"See the family resemblance? ب ت ث share one body and differ only by dots. Dots are not decoration: they are the letter's name tag."},
   {t:"read", h:"Say them like a chain", p:"Alif, Bā, Tā, Thā, Jīm, Ḥā, Khā. Say the chain three times out loud. The Prophet ﷺ taught by kind repetition, three times, so it could be truly grasped (Bukhari 95)."}
  ],
  quiz:[
   {q:"Which letter is Bā’?", a:["ت","ب","ث","ج"], c:1},
   {q:"How many dots does Thā’ ث carry?", a:["One","Two","Three","None"], c:2},
   {q:"Which direction does Arabic read?", a:["Left to right","Right to left","Top to bottom","Either way"], c:1},
   {q:"The deep breathy H from the throat is:", a:["ه","ح","خ","ج"], c:1}
  ]},

{ id:"h2", name:"Letters II · the second seven", mins:8,
  cards:[
   {t:"read", h:"Seven more lights", p:"This group holds the six famous loners of Arabic. Four of them are here: د ذ ر ز never hold the hand of the letter that comes after them. Words simply break after these letters, even in the middle."},
   {t:"letters", set:[["د","Dāl","d as in door"],["ذ","Dhāl","th as in this (voiced)"],["ر","Rā’","a rolled r, tapped on the tongue"],["ز","Zāy","z as in zamzam"],["س","Sīn","s as in sun"],["ش","Shīn","sh as in shade"],["ص","Ṣād","a heavy, full-mouthed s"]]},
   {t:"tip", p:"Ṣād ص is Sīn's big sibling: same hiss, but the mouth makes a dome and the sound gets heavy. Arabic loves these light/heavy pairs; your ear will learn to hear the difference before your mouth masters it."},
   {t:"pairs", rows:[["س → ص","light s → heavy s"],["Connectors","letters that join both ways"],["Non-connectors ا د ذ ر ز و","never join to the NEXT letter"]]}
  ],
  quiz:[
   {q:"Which of these letters never connects to the letter after it?", a:["س","ش","ر","ص"], c:2},
   {q:"Shīn ش sounds like:", a:["s in sun","sh in shade","z in zoo","th in three"], c:1},
   {q:"The heavy S with a full mouth is:", a:["س","ص","ز","ذ"], c:1},
   {q:"Dhāl ذ sounds like the th in:", a:["three","this","thin","math"], c:1}
  ]},

{ id:"h3", name:"Letters III · the third seven", mins:9,
  cards:[
   {t:"read", h:"The proudest sounds", p:"This group holds sounds most languages do not have, including the letter Arabic itself is nicknamed after: Ḍād. Be patient here. Every reciter on earth once struggled with ع."},
   {t:"letters", set:[["ض","Ḍād","a heavy d from the side of the tongue · Arabic is called the language of the Ḍād"],["ط","Ṭā’","a heavy t"],["ظ","Ẓā’","heavy th of “this”"],["ع","ʿAyn","a gentle squeeze of the throat, voice on"],["غ","Ghayn","a soft gargle, like a French r"],["ف","Fā’","f as in fine"],["ق","Qāf","a deep k from the very back"]]},
   {t:"tip", p:"For ʿAyn ع: say “ah” and, without stopping, gently squeeze the sound at the bottom of your throat. It is a hug, not a choke. The word عِلْم (ʿilm, knowledge) begins with it."},
   {t:"read", h:"Qāf vs Kāf", p:"ق is deep, from where you gargle: قُرْآن Qur’ān. Next lesson you meet ك, its lighter cousin from the middle of the mouth: كِتَاب kitāb, book. Deep then light. The Book holds both."}
  ],
  quiz:[
   {q:"Arabic is nicknamed the language of which letter?", a:["ع","ض","ق","ظ"], c:1},
   {q:"ʿAyn ع is made with:", a:["the lips","the teeth","a gentle throat squeeze","the nose"], c:2},
   {q:"The word قُرْآن begins with:", a:["Kāf","Qāf","Ghayn","Fā’"], c:1},
   {q:"Ghayn غ sounds closest to:", a:["a rolled r","a soft gargled r","g in go","h in hello"], c:1}
  ]},

{ id:"h4", name:"Letters IV · the final seven", mins:9,
  cards:[
   {t:"read", h:"Completing the circle", p:"Seven more and the alphabet is yours. Two of these, و and ي, live double lives: consonants at the front of a word, stretchers of sound inside it. And one of them ends the most beautiful word in this library: نُور, light."},
   {t:"letters", set:[["ك","Kāf","k as in kind"],["ل","Lām","l as in lamp"],["م","Mīm","m as in moon"],["ن","Nūn","n as in noon"],["ه","Hā’","a light h as in hello"],["و","Wāw","w as in water · stretches u into oo"],["ي","Yā’","y as in yes · stretches i into ee"]]},
   {t:"tip", p:"You now know every letter in لا إِلَٰهَ إِلَّا اللَّهُ. Look: Lām, Alif, Hamza-Alif, Lām, Hā... The sentence that opens Islam is built from letters you have met."},
   {t:"read", h:"The full chain", p:"Recite the whole alphabet slowly, touching each sound: ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي. Twenty-eight lamps, all lit. Now we teach them to sing."}
  ],
  quiz:[
   {q:"Which letter ends the word نُور (light)?", a:["ن","و","ر","ل"], c:2},
   {q:"Which two letters also stretch vowels long?", a:["ك and ل","و and ي","م and ن","ه and ء"], c:1},
   {q:"Mīm م sounds like:", a:["n in noon","m in moon","b in book","w in water"], c:1},
   {q:"How many letters are in the Arabic alphabet?", a:["26","28","29","32"], c:1}
  ]},

{ id:"h5", name:"The marks that make them sing", mins:10,
  cards:[
   {t:"read", h:"Letters are consonants", p:"By themselves, Arabic letters are all consonant and no vowel: ب is just “b”. The vowels are small marks, harakat, written above or below. Three little marks turn every silent letter into a singer."},
   {t:"pairs", rows:[["بَ · Fatha, a stroke ABOVE","ba · opens the sound into “a”"],["بِ · Kasra, a stroke BELOW","bi · leans the sound into “i”"],["بُ · Damma, a tiny و above","bu · rounds the lips into “u”"],["بْ · Sukun, a small circle","b · no vowel: the letter closes and rests"]]},
   {t:"tip", p:"Test yourself out loud: تَ ta, تِ ti, تُ tu, تْ t. Then with Nūn: نَ na, نِ ni, نُ nu. You are reading. This is actual reading."},
   {t:"read", h:"Why the Qur’an is fully marked", p:"Everyday Arabic hides most harakat and readers guess from experience. The Mushaf marks every single one, so that no reader anywhere, in any century, mispronounces revelation. Precision as mercy."}
  ],
  quiz:[
   {q:"The mark that makes بِ say “bi” is written:", a:["above the letter","below the letter","inside the letter","after the letter"], c:1},
   {q:"Sukun بْ means:", a:["double the letter","a long aa","no vowel, the letter rests","the letter is silent forever"], c:2},
   {q:"دُ reads as:", a:["da","di","du","d"], c:2},
   {q:"Damma looks like a tiny:", a:["circle","wāw و","dot","yā ي"], c:1}
  ]},

{ id:"h6", name:"Doubling, endings & stretchers", mins:10,
  cards:[
   {t:"read", h:"Shadda · the press", p:"A small w-shaped mark ّ doubles its letter: you press it twice, once resting, once sounding. In رَبّ (rabb, Lord) the bā is pressed. In اللَّه itself, the lām carries a shadda. The most spoken word in the world holds one."},
   {t:"pairs", rows:[["بّ · Shadda","bb · the letter pressed twice"],["بًا · Fathatan","ban · the -an ending"],["بٍ · Kasratan","bin · the -in ending"],["بٌ · Dammatan","bun · the -un ending"]]},
   {t:"read", h:"The three stretchers", p:"Alif, Wāw and Yā stretch short vowels long: بَا bā, بُو bū, بِي bī. Twice the breath, same sound. Listen to any reciter and you will hear the stretchers carrying the melody of the Qur’an."},
   {t:"tip", p:"The double-ending marks (tanwin) live at the ends of words: كِتَابٌ kitābun, a book. You will meet them constantly in recitation; now they can never surprise you."}
  ],
  quiz:[
   {q:"Shadda ّ tells you to:", a:["skip the letter","whisper the letter","press the letter twice","stretch the letter"], c:2},
   {q:"بٌ with dammatan reads:", a:["ban","bin","bun","bu"], c:2},
   {q:"Which three letters stretch vowels long?", a:["ا و ي","ب ت ث","ك ل م","ح خ ه"], c:0},
   {q:"In اللَّه, which letter carries the shadda?", a:["Alif","Lām","Hā","none"], c:1}
  ]},

{ id:"h7", name:"Your first reading · the Bismillah", mins:12,
  cards:[
   {t:"read", h:"Everything you need, you have", p:"Four words open the Qur’an, and you now hold every tool needed to read them: the letters, the marks, the stretchers, the shadda. Read each word slowly, right to left, sound by sound."},
   {t:"pairs", rows:[["بِسْمِ","bi-s-mi · “In the name”: Bā with kasra, Sīn resting, Mīm with kasra"],["اللَّهِ","Allāhi · Alif-Lām, Lām pressed with shadda, Hā"],["الرَّحْمَٰنِ","ar-Raḥmāni · the Rā is pressed: the L of “al” melts into it"],["الرَّحِيمِ","ar-Raḥīmi · spot the Yā stretching the ḥī long"]]},
   {t:"ayah", ref:"1:1", ar:"بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ", en:"In the name of Allah, the Most Merciful, the Especially Merciful. Read along with the reciter, finger under each word."},
   {t:"read", h:"You just read Qur’an", p:"Letter by letter, mark by mark, with your own eyes. The very first revealed word was اقْرَأْ, Iqra’: Read. Today you obeyed it in Arabic. Continue in the Mushaf of Light, where every ayah will recite itself to you."}
  ],
  quiz:[
   {q:"In بِسْمِ, the Sīn carries:", a:["fatha","kasra","sukun (rest)","shadda"], c:2},
   {q:"Why is الرَّحْمَٰنِ pronounced “ar-Raḥmān”, not “al-Raḥmān”?", a:["The Alif is silent","Rā is a sun letter: the L melts and Rā doubles","It is an exception with no rule","The Lām is missing"], c:1},
   {q:"Which word of the Bismillah contains a long ī stretched by Yā?", a:["بِسْمِ","اللَّهِ","الرَّحْمَٰنِ","الرَّحِيمِ"], c:3},
   {q:"The first word ever revealed of the Qur’an was:", a:["Bismillah","Iqra’ · Read","Alhamdulillah","Qul"], c:1}
  ]},

{ id:"h8", name:"Sun and moon · reading the-", mins:9,
  cards:[
   {t:"read", h:"One word, two voices", p:"Arabic says the with الـ (al-). Before 14 moon letters the L is heard plainly: الْقَمَر, al-qamar. Before the 14 sun letters the L melts and the next letter doubles: الشَّمْس, ash-shams. You write al- every time; the letters decide what your tongue does."},
   {t:"pairs", rows:[["Sun letters ت ث د ذ ر ز س ش ص ض ط ظ ل ن","the L melts, the letter doubles"],["Moon letters ا ب ج ح خ ع غ ف ق ك م ه و ي","the L stands and is spoken"],["النُّور → an-nūr","sun: you never hear the L"],["الْكِتَاب → al-kitāb","moon: the L rings clear"]]},
   {t:"tip", p:"The trick to remember: sun letters are made near the tongue-tip, exactly where L lives, so L surrenders to its neighbors. Moon letters live far from L, so they leave it alone."},
   {t:"read", h:"Hear it in the Fatiha", p:"You already know this rule by ear: الرَّحْمَٰنِ الرَّحِيمِ is ar-Rahman ar-Rahim, never al-Rahman. Ra is a sun letter. Your tongue has been doing tajwid since your first Bismillah."}
  ],
  quiz:[
   {q:"In الشَّمْس (the sun), the L of al- is:", a:["spoken clearly","silent, and shin doubles","turned into N","dropped with nothing doubled"], c:1},
   {q:"الْقَمَر is pronounced:", a:["aq-qamar","al-qamar","a-qamar","ash-qamar"], c:1},
   {q:"How many sun letters are there?", a:["7","14","21","28"], c:1},
   {q:"Why is it ar-Rahman and not al-Rahman?", a:["An exception with no rule","Ra is a sun letter","The Alif is missing","Old dialect"], c:1}
  ]},

{ id:"h9", name:"Tajwid starter · making it beautiful", mins:10,
  cards:[
   {t:"read", h:"Recite with tartil", p:"And recite the Quran with measured recitation (73:4). Tajwid is not decoration for experts; it is simply pronouncing revelation the way it came down. Four beginner rules carry you a long way, and your ear already knows them from listening."},
   {t:"pairs", rows:[["Madd · stretching","ا و ي after a vowel stretch the sound; some stretches are held 4 to 6 counts: الضَّالِّين"],["Ghunnah · the hum","نّ and مّ with shadda hum through the nose for two counts: إِنَّ inna"],["Qalqalah · the echo","ق ط ب ج د with sukun bounce lightly: أَحَدْ at the end of Al-Ikhlas"],["Stopping","when you stop on a word, its last vowel rests: الرَّحِيمِ read alone ends Rahim"]]},
   {t:"tip", p:"Method of the house: listen to the reciter, echo the ayah, and exaggerate the rule once so your mouth learns its shape. The rules were written down centuries after believers simply imitated beautiful recitation. Imitation is still the royal road."},
   {t:"ayah", ref:"73:4", ar:"وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا", en:"...and recite the Quran with measured recitation. (Al-Muzzammil 73:4). Listen for the stretch inside tartila itself."}
  ],
  quiz:[
   {q:"Tajwid is best described as:", a:["optional decoration","pronouncing the Quran as it was revealed","a modern invention","speed reading"], c:1},
   {q:"Ghunnah is:", a:["a long stretch","a nasal hum on نّ and مّ","a silent letter","an echo on ق"], c:1},
   {q:"The qalqalah letters are:", a:["ا و ي","ق ط ب ج د","ت ث د ذ","م ن ل ر"], c:1},
   {q:"The fastest way for a beginner to learn tajwid is:", a:["memorizing rule books first","listening and echoing a good reciter","reading silently","writing essays"], c:1}
  ]}
]},

/* ============ TRACK 2 · THE FIVE PILLARS ============ */
{ id:"arkan", icon:"columns", ar:"الأَرْكَان", name:"The Five Pillars",
  stage:"Workshop 6-9 · and every newcomer", color:"#33507C",
  desc:"The architecture of a Muslim life: what each pillar is, why it stands, and where the Book and the Prophet ﷺ said it.",
  lessons:[

{ id:"k1", name:"Shahada · the door", mins:8,
  cards:[
   {t:"read", h:"One sentence opens everything", p:"Lā ilāha illa-llāh, Muḥammadun rasūlu-llāh: there is no god but Allah; Muhammad is His Messenger. Said sincerely, this sentence makes a person Muslim. No ceremony, no intermediary, no fee. It is the door, and the door is never locked."},
   {t:"pairs", rows:[["First half · لا إله إلا الله","clears the heart of every false object of worship"],["Second half · محمد رسول الله","binds the heart to the final guidance"]]},
   {t:"ayah", ref:"3:18", ar:"شَهِدَ اللَّهُ أَنَّهُ لَا إِلَـٰهَ إِلَّا هُوَ", en:"“Allah bears witness that there is no god but Him,” and so do the angels and the people of knowledge (3:18)."},
   {t:"read", h:"Islam is built upon five", p:"The Prophet ﷺ said: “Islam is built upon five: the testimony that there is no god but Allah and that Muhammad is the Messenger of Allah, establishing the prayer, giving the zakat, pilgrimage to the House, and the fast of Ramadan.” (Bukhari 8, Muslim 16). This track walks each one."}
  ],
  quiz:[
   {q:"What makes a person Muslim?", a:["A ceremony at a mosque","Sincerely declaring the shahada","Being born in a Muslim land","Memorizing the Qur'an"], c:1},
   {q:"The first half of the shahada rejects:", a:["bad manners","every false object of worship","other languages","the previous prophets"], c:1},
   {q:"“Islam is built upon five” is a hadith found in:", a:["Bukhari and Muslim","only weak collections","the Qur'an","no source"], c:0},
   {q:"How many intermediaries does a person need to enter Islam?", a:["One imam","Two witnesses and a fee","None","A scholar's certificate"], c:2}
  ]},

{ id:"k2", name:"Salah · five meetings a day", mins:10,
  cards:[
   {t:"read", h:"The appointed times", p:"Five prayers anchor the day: Fajr before sunrise (2 rak‘ah), Dhuhr after the sun's peak (4), Asr in the afternoon (4), Maghrib just after sunset (3), Isha at night (4). Seventeen obligatory rak‘ahs, each one a reset of the heart."},
   {t:"pairs", rows:[["Fajr · dawn","2 rak‘ah"],["Dhuhr · midday","4 rak‘ah"],["Asr · afternoon","4 rak‘ah"],["Maghrib · sunset","3 rak‘ah"],["Isha · night","4 rak‘ah"]]},
   {t:"ayah", ref:"4:103", ar:"إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا", en:"“The prayer has been decreed upon the believers at appointed times.” (An-Nisa 4:103)"},
   {t:"read", h:"A river at your door", p:"The Prophet ﷺ asked: if a river ran by your door and you bathed in it five times daily, would any dirt remain? None, they said. “That is the likeness of the five prayers: Allah wipes away sins with them.” (Bukhari 528). The first thing asked about on the Day of Judgment is the prayer (Tirmidhi 413)."}
  ],
  quiz:[
   {q:"How many obligatory rak‘ahs are prayed daily in total?", a:["15","17","19","20"], c:1},
   {q:"Which prayer has 3 rak‘ah?", a:["Fajr","Asr","Maghrib","Isha"], c:2},
   {q:"The five prayers are likened in the hadith to:", a:["a mountain","a river bathed in five times a day","a ladder","a lamp"], c:1},
   {q:"Prayer times are set by:", a:["the clock only","the positions of the sun","local custom","personal choice"], c:1}
  ]},

{ id:"k3", name:"Zakat · the coin in forty", mins:9,
  cards:[
   {t:"read", h:"Wealth that purifies itself", p:"Zakat is 2.5% of qualifying wealth (savings, gold, trade goods) that has stayed above the nisab threshold for one lunar year. The nisab is the value of 85g of gold or 595g of silver. It is not charity from generosity; it is a duty owed by the wealth itself."},
   {t:"pairs", rows:[["Rate","2.5% · one coin in every forty"],["Nisab","85g gold / 595g silver equivalent"],["Held for","one lunar year above nisab"],["Differs from sadaqa","zakat is obligatory and fixed; sadaqa is voluntary and unlimited"]]},
   {t:"ayah", ref:"2:110", ar:"وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ", en:"“Establish the prayer and give the zakat: whatever good you send ahead for yourselves, you will find it with Allah.” (2:110)"},
   {t:"read", h:"Eight doors it may enter", p:"Qur'an 9:60 names exactly who may receive it: the poor, the needy, its administrators, hearts to be reconciled, freeing captives, those in debt, in the cause of Allah, and the stranded traveler. Math with a soul: to compute 2.5%, simply divide by 40."}
  ],
  quiz:[
   {q:"The zakat rate on qualifying wealth is:", a:["10%","5%","2.5%","1%"], c:2},
   {q:"To find 2.5% of an amount, divide it by:", a:["25","40","50","100"], c:1},
   {q:"How many categories of recipient does Qur'an 9:60 name?", a:["Three","Five","Eight","Twelve"], c:2},
   {q:"Zakat differs from sadaqa because zakat is:", a:["secret","obligatory and fixed","only for Ramadan","only for the rich to decide"], c:1}
  ]},

{ id:"k4", name:"Sawm · the month of light", mins:9,
  cards:[
   {t:"read", h:"Dawn to sunset, moon to moon", p:"Ramadan is the ninth month, beginning and ending with the sighting of the new moon. From true dawn to sunset: no food, no drink, no marital relations, and a tightened watch on tongue and temper. The fast trains taqwa: living awareness of Allah."},
   {t:"ayah", ref:"2:183", ar:"يَا أَيُّهَا الَّذِينَ آمَنُوا كُتِبَ عَلَيْكُمُ الصِّيَامُ", en:"“O you who believe, fasting is prescribed for you as it was prescribed for those before you, so that you may attain taqwa.” (2:183)"},
   {t:"pairs", rows:[["Suhur","the pre-dawn meal · a blessed sunnah (Bukhari 1923)"],["Iftar","breaking fast at sunset, traditionally with dates"],["Excused","the sick, travelers, elderly, pregnant and nursing: they make up days or feed the poor (2:184-185)"],["Laylat al-Qadr","one hidden night worth more than a thousand months (97:3)"]]},
   {t:"read", h:"The promise", p:"“Whoever fasts Ramadan out of faith and seeking reward, his past sins are forgiven.” (Bukhari 38, Muslim 760). The month closes with Eid al-Fitr and a small obligatory gift, zakat al-fitr, so that no one is hungry on the day of celebration."}
  ],
  quiz:[
   {q:"Ramadan is which month of the Islamic calendar?", a:["The first","The ninth","The tenth","The twelfth"], c:1},
   {q:"The fast runs from:", a:["sunrise to sunset","true dawn to sunset","midnight to sunset","dawn to midnight"], c:1},
   {q:"Laylat al-Qadr is worth more than:", a:["a hundred nights","a year","a thousand months","ten Ramadans"], c:2},
   {q:"Who is excused from fasting?", a:["No one, ever","Anyone who is busy","The sick, travelers, and similar cases, with make-up or feeding","Only children under 5"], c:2}
  ]},

{ id:"k5", name:"Hajj · the journey of a lifetime", mins:10,
  cards:[
   {t:"read", h:"Once, if you are able", p:"Hajj is owed once in a lifetime by every Muslim whose body and wealth can carry them (3:97). For five or six days in Dhul-Hijjah, millions dress in two plain white cloths, and no one can tell a king from a shepherd. It is the dress rehearsal for the Day everyone stands equal."},
   {t:"steps", list:["Ihram at the boundary: two white cloths and the cry “Labbayk Allahumma labbayk”","Tawaf: seven circuits around the Kaaba","Sa‘i: seven passages between Safa and Marwah, in Hajar's footsteps","Arafah, the 9th day: standing in du‘a until sunset · “Hajj is Arafah” (Tirmidhi 889)","Muzdalifah: a night under the open sky","Jamarat: stoning the pillars where Ibrahim refused Shaytan, then the sacrifice of Eid al-Adha","Tawaf al-Ifadah, hair cut, ihram released, and the farewell circuit"]},
   {t:"ayah", ref:"3:97", ar:"وَلِلَّهِ عَلَى النَّاسِ حِجُّ الْبَيْتِ مَنِ اسْتَطَاعَ إِلَيْهِ سَبِيلًا", en:"“Pilgrimage to the House is a duty owed to Allah by all who can find a way.” (3:97)"},
   {t:"read", h:"The return", p:"“Whoever performs Hajj without obscenity or transgression returns as the day his mother bore him.” (Bukhari 1521). And: “An accepted Hajj has no reward other than Paradise.” (Bukhari 1773, Muslim 1349)."}
  ],
  quiz:[
   {q:"Hajj is obligatory:", a:["every year","once in a lifetime, if able","only for men","only for Arabs"], c:1},
   {q:"“Hajj is ___,” said the Prophet ﷺ:", a:["Tawaf","Arafah","Muzdalifah","Safa"], c:1},
   {q:"How many circuits make one tawaf?", a:["Three","Five","Seven","Ten"], c:2},
   {q:"The pilgrim's two white cloths teach:", a:["fashion","equality of all before Allah","wealth","tribal identity"], c:1}
  ]}
]},

/* ============ TRACK 3 · THE CHAIN OF PROPHETS ============ */
{ id:"anbiya", icon:"dove", ar:"الأَنْبِيَاء", name:"The Chain of Prophets",
  stage:"Workshop → Observatory", color:"#8A9B6E",
  desc:"One message, many messengers: six great lives from the chain of 124,000, told from the Qur'an itself.",
  lessons:[

{ id:"n1", name:"Adam · the first", mins:9,
  cards:[
   {t:"read", h:"Made by two Hands, taught all the names", p:"Allah created Adam from earth, breathed into him of His spirit, and taught him the names of all things: knowledge itself was humanity's first gift. The angels were commanded to prostrate in respect; Iblis refused out of arrogance: “I am better than him.” Arrogance, not ignorance, was the first sin in the story."},
   {t:"ayah", ref:"2:31", ar:"وَعَلَّمَ آدَمَ الْأَسْمَاءَ كُلَّهَا", en:"“And He taught Adam the names, all of them.” (2:31) · Learning is older than sin in the human story."},
   {t:"read", h:"The slip and the turning", p:"Adam and Hawwa were given the Garden and one prohibition. Shaytan whispered; they ate; and then came the sentence that separates Islam's story of humanity from every tale of permanent fallenness: Adam received words from his Lord, and He turned to him in mercy (2:37). We are not children of an unforgivable crime. We are children of the first tawba."},
   {t:"tip", p:"Adam is the first of the chain: the first human, the first prophet, the first to learn, the first to repent, the first to be forgiven."}
  ],
  quiz:[
   {q:"What did Allah teach Adam?", a:["Only farming","The names of all things","One language","Nothing"], c:1},
   {q:"Why did Iblis refuse to prostrate?", a:["Fear","Forgetfulness","Arrogance: “I am better”","He was not commanded"], c:2},
   {q:"After the slip, Adam:", a:["was cast away forever","received words and was forgiven","blamed Hawwa and was punished alone","hid from Allah successfully"], c:1},
   {q:"In Islam, humans are children of:", a:["an unforgivable original sin","the first repentance, accepted","random chance","the angels"], c:1}
  ]},

{ id:"n2", name:"Nuh · the patient builder", mins:9,
  cards:[
   {t:"read", h:"Nine hundred and fifty years", p:"Nuh called his people to Allah for 950 years (29:14): by night and day, in secret and in public. Most mocked him. His reward was not measured in converts but in faithfulness. When the command came, he built the ark on dry land while the chiefs laughed at a ship far from any sea."},
   {t:"ayah", ref:"11:38", ar:"وَيَصْنَعُ الْفُلْكَ وَكُلَّمَا مَرَّ عَلَيْهِ مَلَأٌ مِّن قَوْمِهِ سَخِرُوا مِنْهُ", en:"“He built the ark, and whenever the chiefs of his people passed by, they mocked him.” (11:38)"},
   {t:"read", h:"The flood and the lesson of the son", p:"The flood came from sky and earth together. Pairs of every creature boarded; the believers boarded; and Nuh's own son refused, saying he would climb a mountain. “There is no protector today from Allah's command.” Even a prophet's son must choose for himself: guidance is not inherited like eye color."},
   {t:"tip", p:"Nuh teaches the long game: 950 years without quitting. Results belong to Allah; the calling belongs to us."}
  ],
  quiz:[
   {q:"How long did Nuh call his people?", a:["40 years","100 years","950 years","300 years"], c:2},
   {q:"Where did Nuh build the ark?", a:["On the coast","On dry land, far from the sea","On a mountain","On a river"], c:1},
   {q:"Nuh's son was lost because:", a:["the ark was full","he chose to refuse and trust a mountain","Nuh forgot him","he was too young"], c:1},
   {q:"Nuh's story chiefly teaches:", a:["shipbuilding","patient faithfulness regardless of results","that floods are common","family guarantees salvation"], c:1}
  ]},

{ id:"n3", name:"Ibrahim · the friend of Allah", mins:10,
  cards:[
   {t:"read", h:"The boy who out-argued the sky", p:"Young Ibrahim watched a star set, then the moon, then the sun, and concluded: I do not love things that set (6:76-79). He smashed his people's idols and left the axe on the biggest one: “Ask him!” Thrown into a fire for it, he heard the fire commanded: “Be coolness and peace upon Ibrahim” (21:69)."},
   {t:"ayah", ref:"21:69", ar:"قُلْنَا يَا نَارُ كُونِي بَرْدًا وَسَلَامًا عَلَىٰ إِبْرَاهِيمَ", en:"“We said: O fire, be coolness and peace upon Ibrahim.” (21:69)"},
   {t:"read", h:"The House and the sacrifice", p:"With his son Isma‘il, Ibrahim raised the foundations of the Kaaba, praying “Our Lord, accept from us” (2:127). Tested with the command to sacrifice that same beloved son, both submitted fully; and the ransom came, and the test's point was proven: nothing, not even a son, sits above Allah in a believing heart. Hajj retells his family's story every single year."},
   {t:"tip", p:"Ibrahim is called Khalilullah, the intimate friend of Allah (4:125), and the father of prophets: Isma‘il, Ishaq, and through them the chains to Muhammad ﷺ and to Musa and Isa."}
  ],
  quiz:[
   {q:"Why did Ibrahim reject the star, moon and sun as lords?", a:["They were too small","They set and vanish","They were too far","His people told him to"], c:1},
   {q:"What did the fire become for Ibrahim?", a:["Ash","A wall","Coolness and peace","A storm"], c:2},
   {q:"Who raised the foundations of the Kaaba with Ibrahim?", a:["Ishaq","Isma‘il","Lut","Nuh"], c:1},
   {q:"Ibrahim's special title is:", a:["Kalimullah","Khalilullah · the friend of Allah","Ruhullah","Habibullah"], c:1}
  ]},

{ id:"n4", name:"Musa · spoken to directly", mins:10,
  cards:[
   {t:"read", h:"From the river to the palace", p:"Born under Pharaoh's decree that Israelite boys be killed, Musa was set afloat by his mother on Allah's instruction, and raised in Pharaoh's own palace: the tyrant fed the child who would end him. Grown, and having fled to Madyan, Musa was called at the burning bush in the sacred valley of Tuwa, and Allah spoke to him directly: his title is Kalimullah."},
   {t:"ayah", ref:"20:13", ar:"وَأَنَا اخْتَرْتُكَ فَاسْتَمِعْ لِمَا يُوحَىٰ", en:"“And I have chosen you, so listen to what is revealed.” (Ta-Ha 20:13)"},
   {t:"read", h:"The sea splits", p:"Nine signs did not soften Pharaoh. At the Red Sea, trapped between army and water, Musa's people despaired; Musa did not: “Never! My Lord is with me; He will guide me” (26:62). The sea split into walls, the believers crossed, and the tyrant drowned mid-claim of a last-second faith that came too late. On Sinai, Musa received the Torah."},
   {t:"tip", p:"Musa is the most-mentioned prophet in the Qur'an, named around 136 times: the great story of standing before power with nothing but truth and a staff."}
  ],
  quiz:[
   {q:"Musa's title Kalimullah means:", a:["Friend of Allah","The one Allah spoke to directly","Spirit of Allah","Servant of Allah"], c:1},
   {q:"Where was Musa raised?", a:["In Madyan","In Pharaoh's own palace","In Sinai","In Jerusalem"], c:1},
   {q:"At the sea, Musa said:", a:["“We are finished”","“Never! My Lord is with me; He will guide me”","“Swim!”","Nothing"], c:1},
   {q:"Which scripture was given to Musa?", a:["The Zabur","The Injil","The Torah","The Scrolls of Ibrahim"], c:2}
  ]},

{ id:"n5", name:"Isa · the word and the sign", mins:10,
  cards:[
   {t:"read", h:"A miracle from the first breath", p:"Isa was born of the virgin Maryam, the purest woman of creation, by Allah's word “Be”: a creation like Adam's, who had neither father nor mother (3:59). As an infant in the cradle he spoke, defending his mother's honor: “I am the servant of Allah; He gave me the Book and made me a prophet” (19:30). His first sentence defined him: servant, not son."},
   {t:"ayah", ref:"19:30", ar:"قَالَ إِنِّي عَبْدُ اللَّهِ آتَانِيَ الْكِتَابَ وَجَعَلَنِي نَبِيًّا", en:"“He said: I am indeed the servant of Allah; He has given me the Book and made me a prophet.” (Maryam 19:30)"},
   {t:"read", h:"By Allah's permission", p:"He healed the born-blind and the leper, and raised the dead: each time, the Qur'an adds, bi-idhnillah, by Allah's permission (3:49): the miracles were Allah's power flowing through His messenger. He brought the Injil, confirmed the Torah, and gave glad tidings of a messenger to come. He was neither killed nor crucified: Allah raised him to Himself (4:157-158), and Muslims await his return."},
   {t:"tip", p:"No Muslim is Muslim without loving and believing in Isa: a mighty messenger honored in the Qur'an, where Maryam has an entire surah bearing her name."}
  ],
  quiz:[
   {q:"Isa's birth is compared in the Qur'an to the creation of:", a:["Musa","Adam","Nuh","the angels"], c:1},
   {q:"His first recorded words, in the cradle, were:", a:["“I am the son of Allah”","“I am the servant of Allah”","“Worship my mother”","He did not speak"], c:1},
   {q:"Isa's miracles happened:", a:["by his own independent power","by Allah's permission","only in stories","by medicine"], c:1},
   {q:"Regarding the crucifixion, the Qur'an says:", a:["he was killed","he was crucified and then revived","he was neither killed nor crucified; Allah raised him","nothing at all"], c:2}
  ]},

{ id:"n6", name:"Muhammad ﷺ · the seal", mins:12,
  cards:[
   {t:"read", h:"Al-Amin before the revelation", p:"Born in Makkah in the Year of the Elephant, orphaned young, he was so known for honesty that his people titled him al-Amin, the Trustworthy, decades before prophethood. At forty, in the cave of Hira, the angel Jibril came with one word: Iqra'. Read. The final revelation had begun, and it would descend for twenty-three years."},
   {t:"ayah", ref:"33:40", ar:"مَّا كَانَ مُحَمَّدٌ أَبَا أَحَدٍ مِّن رِّجَالِكُمْ وَلَـٰكِن رَّسُولَ اللَّهِ وَخَاتَمَ النَّبِيِّينَ", en:"“Muhammad is not the father of any of your men, but the Messenger of Allah and the Seal of the Prophets.” (33:40)"},
   {t:"read", h:"Makkah's patience, Madinah's building", p:"Thirteen years in Makkah: mockery, boycott, and gentleness under persecution. Then the Hijra to Madinah, where the first community was built on brotherhood, and the message completed: worship, law, mercy to neighbors, rights of women and orphans, freeing of slaves. At the Farewell Sermon he ﷺ declared no Arab superior to a non-Arab, nor white to black, except by taqwa."},
   {t:"read", h:"Mercy to the worlds", p:"“We have not sent you except as a mercy to the worlds” (21:107). He mended his own sandals, stopped sermons to let his grandsons climb him, stood in prayer until his feet swelled, and at the conquest of Makkah, facing those who had tortured his companions for twenty years, said: Go, for you are free. He ﷺ is the seal: after him, no prophet; with him, the chain of 124,000 is complete."},
   {t:"tip", p:"To study his life in full depth, open the final chapter of the Prophets room: the complete Seerah with sources awaits there."}
  ],
  quiz:[
   {q:"Before prophethood, Makkah called Muhammad ﷺ:", a:["al-Amin, the Trustworthy","al-Qawi, the Strong","al-Ghani, the Rich","nothing special"], c:0},
   {q:"The first revealed word was:", a:["Pray","Read","Fast","Give"], c:1},
   {q:"“Seal of the Prophets” means:", a:["the best writer","the final prophet, none after him","the leader of Makkah","a royal title"], c:1},
   {q:"At the conquest of Makkah, he ﷺ treated his former persecutors with:", a:["exile","imprisonment","a general amnesty: “you are free”","heavy taxes"], c:2}
  ]},

{ id:"n7", name:"Yusuf · the best of stories", mins:11,
  cards:[
   {t:"read", h:"A dream in the night", p:"The Quran itself calls Surah Yusuf the best of stories (12:3). A boy dreams of eleven stars, the sun and the moon bowing to him. His father Yaqub, a prophet, understands, and warns him: do not tell your brothers. Jealousy was already circling the house of a prophet; no family is immune."},
   {t:"ayah", ref:"12:4", ar:"إِنِّي رَأَيْتُ أَحَدَ عَشَرَ كَوْكَبًا وَالشَّمْسَ وَالْقَمَرَ رَأَيْتُهُمْ لِي سَاجِدِينَ", en:"I saw eleven stars and the sun and the moon: I saw them prostrating to me. (12:4)"},
   {t:"read", h:"The well, the palace, the prison", p:"His brothers threw him in a well; traders sold him into Egypt; the ministers wife tried to seduce him and he chose prison over sin: My Lord, prison is more beloved to me (12:33). In prison he interpreted dreams and preached tawhid. Years later, the kings dream of seven fat and seven lean cows brought him out, cleared his name publicly, and made him treasurer of Egypt: the boy from the well now fed nations through famine."},
   {t:"read", h:"No blame upon you today", p:"When his brothers, starving, stood unknowingly before him, he revealed himself and spoke one of the Qurans most healing lines: No blame upon you today; Allah will forgive you (12:92). The dream came true: his family bowed. He held power, held his tears, and held no grudge. Every wounded family reads this surah and finds a road home."}
  ],
  quiz:[
   {q:"Surah Yusuf is called in its own opening:", a:["the hardest story","the best of stories","a short story","a parable only"], c:1},
   {q:"Yusuf preferred prison over:", a:["work","sin","Egypt","travel"], c:1},
   {q:"The kings dream that freed Yusuf involved:", a:["eleven stars","seven cows, fat and lean","a burning tree","a flooded river"], c:1},
   {q:"To his brothers, Yusuf finally said:", a:["Leave Egypt","No blame upon you today","Return the money","Nothing"], c:1}
  ]},

{ id:"n8", name:"Ayyub & Yunus · two schools of patience", mins:10,
  cards:[
   {t:"read", h:"Ayyub · patience that keeps praising", p:"Ayyub had wealth, family and health, and lost all three. Years of illness took everything but his tongues gratitude. His dua is studied for its manners: he did not list demands; he described his state and praised his Lord: Indeed, harm has touched me, and You are the Most Merciful of the merciful (21:83). Allah restored him and doubled what he had lost. The Qurans verdict: How excellent a servant! He was ever turning back to Allah (38:44)."},
   {t:"ayah", ref:"21:87", ar:"لَّا إِلَـٰهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ", en:"There is no god but You; glory be to You; indeed I was among the wrongdoers. Yunus, from the belly of the whale (21:87)."},
   {t:"read", h:"Yunus · patience that returns", p:"Yunus left his city in anger before Allahs permission. Swallowed by the whale, wrapped in three darknesses of night, sea and belly, he prayed the words above, admitting fault with no excuse attached. Allah says: had he not been of those who glorify, he would have remained inside it until the Day of Resurrection (37:143-144). The Prophet ﷺ taught that no Muslim prays with the dua of Yunus except that Allah answers (Tirmidhi 3505)."},
   {t:"tip", p:"Two schools, one lesson: Ayyub shows patience when the harm is not your fault; Yunus shows the return when it is. Between the two of them, every hard day you will ever have is covered."}
  ],
  quiz:[
   {q:"Ayyubs dua is loved for its:", a:["length","demands","gentle manners: describing, not demanding","poetry"], c:2},
   {q:"The three darknesses around Yunus were:", a:["fear, doubt, anger","night, sea, and the whales belly","three nights","caves"], c:1},
   {q:"The dua of Yunus begins:", a:["Rabbi zidni ilma","La ilaha illa anta subhanak...","Alhamdulillah","Astaghfirullah"], c:1},
   {q:"What saved Yunus, per 37:143?", a:["swimming","his being of those who glorify Allah","a passing ship","the whales mercy"], c:1}
  ]},

{ id:"n9", name:"Dawud & Sulayman · kingdom as worship", mins:10,
  cards:[
   {t:"read", h:"Dawud · the iron and the voice", p:"Dawud was given the Zabur, a voice so beautiful that mountains and birds echoed his praise (34:10), and a kingdom he never let corrupt him: he ate from the work of his own hands (Bukhari 2072). Allah softened iron in his hands; he was a judge who feared misjudging, and as a youth he had felled Jalut (Goliath) with a sling and certainty (2:251)."},
   {t:"ayah", ref:"27:19", ar:"رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ وَعَلَىٰ وَالِدَيَّ", en:"Sulaymans dua after smiling at the ant: My Lord, enable me to be grateful for Your favor upon me and upon my parents... (27:19)"},
   {t:"read", h:"Sulayman · power that stayed humble", p:"His son Sulayman was given what no king before or after held: the wind to ride, jinn in service, and the speech of birds and ants (27:16). Marching with an army, he heard one ant warn her colony to hide, and the mightiest man alive smiled, and asked Allah for gratitude, not for more power. He tested and then guided the Queen of Saba (Bilqis) to Islam with wisdom, not conquest (27:44)."},
   {t:"tip", p:"The lesson pair: power did not spoil the father, and unimaginable power did not spoil the son. In this Madrasa, that is the definition of strength: what you can carry without it changing your sujud."}
  ],
  quiz:[
   {q:"What was softened for Dawud?", a:["stone","iron","gold","wood"], c:1},
   {q:"As a youth, Dawud felled:", a:["a lion","Jalut (Goliath)","a fortress","Pharaoh"], c:1},
   {q:"Sulayman smiled because:", a:["he won a battle","he heard an ant warning her colony","the wind obeyed","gold arrived"], c:1},
   {q:"After hearing the ant, Sulayman asked Allah for:", a:["a bigger army","gratitude","longer life","more kingdoms"], c:1}
  ]}
]},

/* ============ TRACK 4 · WORSHIP IN PRACTICE ============ */
{ id:"ibada", icon:"drop", ar:"الْعِبَادَة", name:"Worship in Practice",
  stage:"Garden → Workshop · and every newcomer", color:"#7FA3D8",
  desc:"The how-to track: wudu step by step, the salah movement by movement, the day's adhkar, and the manners of the masjid.",
  lessons:[

{ id:"w1", name:"Wudu · the washing of light", mins:9,
  cards:[
   {t:"read", h:"Purification is half of faith", p:"Before standing in prayer, a Muslim washes: not merely hygiene, but a switching of state. The Prophet ﷺ said purification is half of faith (Muslim 223), and that on the Day of Judgment his people will be called with faces and limbs glowing from the traces of wudu (Bukhari 136)."},
   {t:"steps", list:["Intention in the heart, and Bismillah","Wash the hands to the wrists, three times","Rinse the mouth three times","Sniff water gently into the nose and out, three times","Wash the face three times, hairline to chin, ear to ear","Wash the right arm to the elbow three times, then the left","Wipe the wet hands once over the head, then the ears","Wash the right foot to the ankle three times, then the left"]},
   {t:"pairs", rows:[["Wudu is broken by","using the toilet, passing wind, deep sleep, loss of consciousness"],["Then simply","repeat wudu before the next prayer"],["Right before left","the sunnah order in washing (Bukhari 168)"]]},
   {t:"tip", p:"After wudu, the shahada is said, and the Prophet ﷺ promised that the eight gates of Paradise open for the one who says it (Muslim 234). A tap, a towel, and gates."}
  ],
  quiz:[
   {q:"“Purification is ___ of faith,” said the Prophet ﷺ:", a:["a tenth","a third","half","all"], c:2},
   {q:"Which is washed first?", a:["Left arm before right","Right arm before left","Feet before face","Ears before mouth"], c:1},
   {q:"The head is wiped:", a:["three times","twice","once","never"], c:2},
   {q:"Which of these breaks wudu?", a:["Eating dates","Deep sleep","Reading aloud","Smiling"], c:1}
  ]},

{ id:"w2", name:"The Salah · movement by movement", mins:12,
  cards:[
   {t:"read", h:"One rak‘ah, the building block", p:"Every prayer is built from rak‘ahs, and every rak‘ah has the same skeleton. Learn one deeply and you have learned them all. Face the qibla, raise your hands, and say Allahu Akbar: the world is now behind you."},
   {t:"steps", list:["Qiyam · standing: recite Al-Fatiha (and a surah after it in the first two rak‘ahs)","Ruku · bowing, back straight: “Subhana Rabbiyal-Adhim” three times","Stand again: “Sami‘Allahu liman hamidah, Rabbana wa lakal-hamd”","Sujud · forehead, nose, palms, knees and toes on the ground: “Subhana Rabbiyal-A‘la” three times","Sit briefly, then a second sujud: one rak‘ah is complete","Every second rak‘ah, remain sitting for the tashahhud","At the end: salam to the right, salam to the left"]},
   {t:"pairs", rows:[["Sujud","the closest a servant is to their Lord (Muslim 482)"],["Tashahhud","the sitting testimony, greeting Allah, His Prophet, and the righteous"],["The two salams","closing the meeting by greeting those on either side"]]},
   {t:"tip", p:"Khushu, presence of heart, is the soul of it all. The limbs learn in a week; the heart trains for a lifetime, and that training is the point."}
  ],
  quiz:[
   {q:"What is recited standing in every rak‘ah?", a:["Ayat al-Kursi","Al-Fatiha","The tashahhud","Any du‘a"], c:1},
   {q:"In sujud, a servant is:", a:["farthest from Allah","closest to Allah","asleep","finished"], c:1},
   {q:"“Subhana Rabbiyal-Adhim” is said in:", a:["sujud","ruku (bowing)","tashahhud","the salam"], c:1},
   {q:"The prayer ends with:", a:["clapping","salam to the right and left","a bow","silence only"], c:1}
  ]},

{ id:"w3", name:"The day's adhkar · a garland of words", mins:9,
  cards:[
   {t:"read", h:"Words worn through the day", p:"The sunnah wraps the whole day in short remembrances: waking, dressing, eating, leaving, returning, sleeping. None takes ten seconds; together they keep the heart's compass pointed home all day long."},
   {t:"pairs", rows:[["On waking","Alhamdu lillahil-ladhi ahyana ba‘da ma amatana wa ilayhin-nushur (Bukhari 6312)"],["Before eating","Bismillah · and if forgotten: Bismillahi fi awwalihi wa akhirihi (Abu Dawud 3767)"],["Leaving home","Bismillah, tawakkaltu ‘alallah, la hawla wa la quwwata illa billah (Abu Dawud 5095)"],["Any moment","SubhanAllah · Alhamdulillah · Allahu Akbar: heavy on the scale, light on the tongue (Bukhari 6682)"]]},
   {t:"read", h:"The armor of the night", p:"Before sleep: recite Ayat al-Kursi, and no devil approaches until morning (Bukhari 2311). Cup the hands, recite the three Quls, blow gently, and wipe over the body, as the Prophet ﷺ did every night (Bukhari 5017). Sleep itself becomes worship when entered with remembrance."},
   {t:"tip", p:"Start with just two: the waking line and the sleeping ritual. Bookend the day, then fill the middle as the habit grows."}
  ],
  quiz:[
   {q:"Ayat al-Kursi before sleep protects until:", a:["midnight","Fajr time","morning","the next prayer"], c:2},
   {q:"If you forget Bismillah before eating, you say:", a:["nothing can be done","Bismillahi fi awwalihi wa akhirihi","the meal is invalid","Alhamdulillah twice"], c:1},
   {q:"The three Quls at night are recited into:", a:["the pillow","cupped hands, then wiped over the body","a glass of water","the air"], c:1},
   {q:"“Two words light on the tongue, heavy on the scale” refers to:", a:["long speeches","SubhanAllahi wa bihamdih, SubhanAllahil-Adhim","secret words","any poetry"], c:1}
  ]},

{ id:"w4", name:"Jumu‘ah & the manners of the masjid", mins:8,
  cards:[
   {t:"read", h:"The weekly Eid", p:"Friday is the best day the sun rises upon (Muslim 854). The Dhuhr prayer becomes Jumu‘ah: a congregation with a khutbah, obligatory for men and open to all. Ghusl, best clothes, early arrival, and listening silently to the khutbah are its adab: even saying “listen!” to a neighbor during the khutbah is discouraged (Bukhari 934)."},
   {t:"pairs", rows:[["Entering the masjid","right foot first: “Allahummaftah li abwaba rahmatik”"],["Before sitting","two light rak‘ahs of greeting, tahiyyat al-masjid (Bukhari 444)"],["During khutbah","complete, attentive silence"],["Leaving","left foot first: asking of Allah's bounty"]]},
   {t:"read", h:"An hour of answered du‘a", p:"Within Friday hides an hour in which no Muslim asks Allah for good except that He grants it (Bukhari 935). Many scholars hold it is the last hour before Maghrib. A weekly appointment with a guaranteed audience: the believer does not miss it."},
   {t:"tip", p:"And send abundant salawat on the Prophet ﷺ on Fridays: it is presented to him (Abu Dawud 1047)."}
  ],
  quiz:[
   {q:"Jumu‘ah replaces which daily prayer on Friday?", a:["Fajr","Dhuhr","Asr","Isha"], c:1},
   {q:"During the khutbah one should:", a:["chat quietly","listen in complete silence","scroll the phone","sleep"], c:1},
   {q:"On entering the masjid, pray:", a:["nothing","two rak‘ahs of greeting","four rak‘ahs loudly","only on Fridays"], c:1},
   {q:"Friday contains:", a:["an hour of answered du‘a","a forbidden hour","no special virtue","only rest"], c:0}
  ]},

{ id:"w5", name:"Ramadan in practice · the how-to", mins:10,
  cards:[
   {t:"read", h:"The night before, the dawn of", p:"Intend the fast each night; it lives in the heart, no formula required. Rise for suhur even if only water and a date: there is blessing in the pre-dawn meal (Bukhari 1923), and delaying suhur toward dawn is sunnah. Stop eating at true dawn, when Fajr enters, not at some cautious minute of your own invention."},
   {t:"pairs", rows:[["Iftar","hasten it at sunset: the people remain upon good so long as they hasten the breaking of the fast (Bukhari 1957)"],["How to break it","fresh or dried dates, else water, as he ﷺ did (Abu Dawud 2356)"],["The nights","extra night prayer in congregation or alone: whoever stands Ramadan in prayer out of faith is forgiven past sins (Bukhari 37)"],["Last ten nights","seek Laylat al-Qadr in the odd nights; some retreat in itikaf as he ﷺ did every year (Bukhari 2025)"]]},
   {t:"read", h:"What does not break the fast", p:"Forgetting and eating: it is food Allah fed you; complete your fast (Bukhari 1933). Tasting nothing, swallowing accidental dust, a toothbrush, a shower, an injection that is not nourishment (per broad scholarly positions): the fast is not made of glass. What truly breaks it besides food, drink and marital relations by day: deliberate vomiting, and scholars details differ; ask yours."},
   {t:"read", h:"Before the Eid prayer", p:"Zakat al-Fitr, a small fixed gift of food or its value for every member of the household, must reach the poor before the Eid prayer (Bukhari 1503): it purifies the fast and makes sure no one is hungry on the morning of celebration. The month ends the way it lived: with someone else fed."}
  ],
  quiz:[
   {q:"The sunnah timing of iftar is:", a:["delay it after Maghrib","hasten it at sunset","midnight","any time"], c:1},
   {q:"Eating out of pure forgetfulness while fasting:", a:["breaks the fast","requires a penalty","does not break the fast: complete it","ends Ramadan"], c:2},
   {q:"Laylat al-Qadr is sought:", a:["the first night","the 15th","in the odd last-ten nights","after Eid"], c:2},
   {q:"Zakat al-Fitr must be given:", a:["anytime that year","before the Eid prayer","only by the rich","after Eid"], c:1}
  ]},

{ id:"w6", name:"The two Eids & the ten best days", mins:9,
  cards:[
   {t:"read", h:"Eid al-Fitr · the morning of gratitude", p:"Ghusl, your best clothes, and an odd number of dates before leaving for Eid al-Fitr prayer (Bukhari 953). The takbir rings from the night before: Allahu Akbar, Allahu Akbar, la ilaha illallah. The prayer is two rakah with extra takbirs, then a khutbah; the sunnah is to return home by a different road (Bukhari 986), spreading salam through more of the town."},
   {t:"pairs", rows:[["Dhul-Hijjah 1-10","no days in which good deeds are more beloved to Allah than these (Bukhari 969)"],["The Day of Arafah (9th)","fasting it, for non-pilgrims, expiates the year before and the year after (Muslim 1162)"],["Eid al-Adha (10th)","the prayer, then the udhiyah sacrifice, echoing Ibrahims obedience; meat shared with family, neighbors and the poor"],["The takbir days","takbir continues through the days of tashriq (11th-13th)"]]},
   {t:"read", h:"What the Eids teach", p:"Fitr celebrates a month of restraint; Adha celebrates a lifetime of surrender compressed into one fathers test. Neither is about the food: both begin with prayer, both are engineered so the poor celebrate too, and both are days when sadness is told firmly to wait."},
   {t:"tip", p:"Practical: learn the takbir now, teach it to the household, and decide before Dhul-Hijjah arrives who your udhiyah will reach. The best deeds of the best days go to the prepared."}
  ],
  quiz:[
   {q:"Before Eid al-Fitr prayer, the sunnah is to:", a:["fast until noon","eat an odd number of dates","skip breakfast","sleep in"], c:1},
   {q:"The best days for good deeds are:", a:["the last ten of Ramadan","the first ten of Dhul-Hijjah","Fridays only","the 15th of Shaban"], c:1},
   {q:"Fasting the Day of Arafah (for non-pilgrims):", a:["is forbidden","expiates two years","replaces Ramadan","is only for scholars"], c:1},
   {q:"After Eid prayer the sunnah road home is:", a:["the same road","a different road","running","by night"], c:1}
  ]}
]},

/* ============ TRACK 5 · WHAT WE BELIEVE ============ */
{ id:"iman", icon:"heart", ar:"الْإِيمَان", name:"What We Believe",
  stage:"Workshop → Observatory", color:"#E9C86A",
  desc:"The six pillars of iman, the Names of Allah to live with, and the unseen world of angels and revealed books.",
  lessons:[

{ id:"i1", name:"The six pillars of iman", mins:9,
  cards:[
   {t:"read", h:"What faith stands on", p:"When Jibril came in human form and asked the Prophet ﷺ “What is iman?”, the answer drew the map of Muslim belief: to believe in Allah, His angels, His books, His messengers, the Last Day, and the decree, its good and its hard (Muslim 8, the hadith of Jibril)."},
   {t:"pairs", rows:[["1 · Allah","One, without partner, unlike anything (112:4)"],["2 · The angels","made of light, never disobeying"],["3 · The books","Suhuf, Torah, Zabur, Injil, and the Qur'an, the final and guarded"],["4 · The messengers","from Adam to Muhammad ﷺ, one chain"],["5 · The Last Day","resurrection, account, mizan, Paradise and Fire"],["6 · The decree (qadr)","nothing escapes Allah's knowledge and will"]]},
   {t:"read", h:"Belief in qadr, lived", p:"The decree is not fatalism: we act with full effort, then rest in the outcome. The Prophet ﷺ taught: “Strive for what benefits you, seek Allah's help, and do not say ‘if only’: say ‘Allah decreed, and what He willed, He did.’” (Muslim 2664). Full effort, full trust: both hands on the plough, heart in the sky."},
   {t:"tip", p:"Islam is what the limbs do (the five pillars); iman is what the heart holds (these six); ihsan, the third level in the same hadith, is to worship Allah as if you see Him."}
  ],
  quiz:[
   {q:"How many pillars of iman are there?", a:["Four","Five","Six","Seven"], c:2},
   {q:"The famous hadith listing them is known as the hadith of:", a:["the mountain","Jibril","the cave","the sea"], c:1},
   {q:"Belief in qadr means:", a:["do nothing, all is written","strive fully, then trust the outcome to Allah","only good is decreed","luck rules"], c:1},
   {q:"Ihsan is:", a:["extra charity","worshipping Allah as if you see Him","a type of fasting","a pilgrimage"], c:1}
  ]},

{ id:"i2", name:"Five Names to live with", mins:9,
  cards:[
   {t:"read", h:"The most beautiful Names", p:"“To Allah belong the most beautiful Names, so call on Him by them” (7:180). The famous narration counts ninety-nine; each is a window onto how Allah deals with creation, and a way to call on Him. Here are five to carry this month: one for each kind of day."},
   {t:"pairs", rows:[["الرَّحْمَٰن Ar-Rahman","The Most Merciful: mercy wide as everything that exists · for every day"],["اللَّطِيف Al-Latif","The Subtle-Kind: arranging good invisibly, gently · for confusing days"],["الْغَفُور Al-Ghafur","The All-Forgiving: again, and again, and again · for heavy days"],["الرَّزَّاق Ar-Razzaq","The Provider: no soul's provision is forgotten · for anxious days"],["النُّور An-Nur","The Light: of the heavens and the earth (24:35) · for dark days"]]},
   {t:"read", h:"How to use a Name", p:"Not as trivia but as address. Overwhelmed? “Ya Latif, be gentle with my affairs.” Ashamed? “Ya Ghafur, forgive me again.” The Names turn theology into conversation, which is exactly what du‘a is."},
   {t:"tip", p:"This library is named from An-Nur. Every time you open it, you are inside one of the Names."}
  ],
  quiz:[
   {q:"The Qur'an says to do what with the beautiful Names?", a:["memorize them only","call on Allah by them","debate them","write them on walls"], c:1},
   {q:"Al-Latif means:", a:["The Strong","The Subtle-Kind, gently arranging good","The Judge","The First"], c:1},
   {q:"For anxiety about provision, one calls on:", a:["An-Nur","Ar-Razzaq","Al-Ghafur","none"], c:1},
   {q:"An-Nur means:", a:["The Fire","The Light","The Star","The Moon"], c:1}
  ]},

{ id:"i3", name:"Angels & the revealed books", mins:9,
  cards:[
   {t:"read", h:"An unseen civil service of light", p:"Created from light, angels neither eat, tire, nor disobey. Jibril carries revelation; Mika'il is associated with provision and rain; Israfil awaits the Trumpet; the Angel of Death fulfills every appointment. Two recorders sit at every person's shoulders (50:17-18), and angels crowd every gathering where Allah is remembered (Muslim 2689)."},
   {t:"pairs", rows:[["Jibril","brought every revelation to every prophet"],["Kiraman Katibin","the noble scribes on your right and left"],["Guardians in relays","angels take turns keeping watch over you (13:11)"],["The Trumpet-bearer","Israfil, waiting for the command"]]},
   {t:"read", h:"One library, many volumes", p:"Allah sent scriptures throughout the chain: the Scrolls of Ibrahim, the Torah to Musa, the Zabur to Dawud, the Injil to Isa, and finally the Qur'an, which confirms what came before it and is the only one Allah Himself guaranteed to guard from corruption: “We sent down the Reminder, and We are surely its Guardians” (15:9)."},
   {t:"tip", p:"Fourteen centuries of manuscripts agree letter for letter with the Mushaf in your hand. The promise of 15:9 is checkable, and it checks out."}
  ],
  quiz:[
   {q:"Angels are created from:", a:["fire","clay","light","water"], c:2},
   {q:"Which angel brought revelation to the prophets?", a:["Mika'il","Jibril","Israfil","Malik"], c:1},
   {q:"The Kiraman Katibin are:", a:["ancient kings","the recording angels at your shoulders","two mountains","prayer times"], c:1},
   {q:"Which book did Allah promise to guard Himself?", a:["The Torah","The Injil","The Zabur","The Qur'an"], c:3}
  ]},

{ id:"i4", name:"The Last Day · the honest map", mins:10,
  cards:[
   {t:"read", h:"Why a Last Day at all", p:"Without a final accounting, the oppressor who dies comfortable wins forever, and the wronged who die unheard lose forever. The Last Day is Allahs promise that no atom of good or evil goes unweighed: Whoever does an atoms weight of good will see it, and whoever does an atoms weight of evil will see it (99:7-8). Belief in it is not fear-mongering; it is the deepest justice claim ever made."},
   {t:"ayah", ref:"99:7", ar:"فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ", en:"Whoever does an atoms weight of good will see it. (Az-Zalzalah 99:7)"},
   {t:"pairs", rows:[["The Trumpet & Resurrection","all raised as easily as first created: He will revive them Who produced them the first time (36:79)"],["The Book & the Scales","deeds recorded and weighed; We place the scales of justice, and no soul is wronged at all (21:47)"],["The Hawd & the Sirat","the Prophets ﷺ pool for his ummah, and the crossing over the Fire, both from authentic hadith"],["Shafaah","intercession by his ﷺ permission-given plea for the believers (Bukhari 7410)"]]},
   {t:"read", h:"Living with it, not paralyzed by it", p:"The Quran pairs every warning with a door: mercy outruns wrath, one good deed counts tenfold, and repentance erases what came before. The believer holds fear and hope like two wings: enough fear to avoid the sin, enough hope to never despair of the Forgiver. That balance, not terror, is what belief in the Last Day builds."}
  ],
  quiz:[
   {q:"The Last Day is, at its heart, a promise of:", a:["fear","perfect justice for every atom","endings only","mystery"], c:1},
   {q:"Per 21:47, the scales of justice wrong:", a:["some souls","no soul at all","only the rich","only nations"], c:1},
   {q:"The believers attitude to the Last Day is:", a:["terror only","denial","fear and hope held together","indifference"], c:2},
   {q:"A single good deed is rewarded:", a:["once exactly","tenfold or more","only if public","only in Ramadan"], c:1}
  ]}
]},

/* ============ TRACK 6 · THE GOLDEN INHERITANCE ============ */
{ id:"hikma", icon:"scope", ar:"الْحِكْمَة", name:"The Golden Inheritance",
  stage:"Observatory 9-12", color:"#8a6d1a",
  desc:"STEM as heritage: the method, the numbers, and the builders who made Muslims the teachers of the world.",
  lessons:[

{ id:"g1", name:"The method of Ibn al-Haytham", mins:9,
  cards:[
   {t:"read", h:"Doubt as a duty", p:"A thousand years ago in Cairo, Ibn al-Haytham wrote that the seeker of truth must question even the great ancients and accept only what demonstration proves. Then he lived it: darkened rooms, pinholes, screens, one variable changed at a time, until he had proven that light travels in straight lines into the eye. The scientific method has a birth certificate, and it is written in Arabic."},
   {t:"steps", list:["Observe something carefully and honestly","Ask one precise question about it","Guess an answer (the hypothesis)","Test the guess fairly, changing only one thing","Record what actually happened, even if the guess dies","Share it so others can check and build"]},
   {t:"ayah", ref:"3:190", ar:"إِنَّ فِي خَلْقِ السَّمَاوَاتِ وَالْأَرْضِ وَاخْتِلَافِ اللَّيْلِ وَالنَّهَارِ لَآيَاتٍ لِّأُولِي الْأَلْبَابِ", en:"“In the creation of the heavens and the earth and the alternation of night and day are signs for people of understanding.” (3:190) · Observation is commanded, not just permitted."},
   {t:"tip", p:"Try it this week: the shoebox camera. Instructions live in the Madrasa's project shelf on the school page. When the image lands upside down, you will ask his exact question."}
  ],
  quiz:[
   {q:"Ibn al-Haytham proved that sight works by:", a:["rays leaving the eyes","light entering the eyes","sound waves","imagination"], c:1},
   {q:"A fair test changes:", a:["everything at once","nothing","only one thing at a time","the results"], c:2},
   {q:"When an experiment kills your guess, you:", a:["hide the result","record it honestly","change the data","stop science"], c:1},
   {q:"The Qur'an's attitude to observing creation is:", a:["forbidden","discouraged","commanded as a sign-reading","irrelevant"], c:2}
  ]},

{ id:"g2", name:"The numbers of al-Khwarizmi", mins:9,
  cards:[
   {t:"read", h:"Algebra was born for justice", p:"In Baghdad's House of Wisdom, al-Khwarizmi wrote the book that named algebra (al-jabr, restoration): its purpose was dividing inheritances and computing zakat exactly as revelation required. Faith demanded precision; precision produced mathematics. His name, Latinized, became “algorithm”: every app you use runs on his name."},
   {t:"pairs", rows:[["x + 5 = 12","subtract 5 from both sides: restoration"],["x = 7","the unknown surrenders"],["Zakat shortcut","2.5% of anything = that amount ÷ 40"],["The digits 0-9","carried by his book from India to the world"]]},
   {t:"read", h:"Try the zakat sum", p:"A family has 8,000 in savings held a year, above nisab. Divide by 40: the zakat is 200. Now their own numbers: this is the actual computation performed in millions of Muslim homes every year, exactly as his book intended twelve centuries ago."},
   {t:"tip", p:"When you divide by 40 for zakat, you are using al-jabr for its original purpose: worship, dressed as arithmetic."}
  ],
  quiz:[
   {q:"The word “algebra” comes from:", a:["a Greek city","al-jabr, restoration","a Latin poet","nowhere known"], c:1},
   {q:"“Algorithm” is named after:", a:["a machine","al-Khwarizmi","a Greek letter","logic"], c:1},
   {q:"Zakat of 8,000 (÷40) is:", a:["80","150","200","400"], c:2},
   {q:"Al-Khwarizmi's algebra book was written to serve:", a:["war","inheritance and zakat justice","astronomy only","banking"], c:1}
  ]},

{ id:"g3", name:"Builders & travelers", mins:10,
  cards:[
   {t:"read", h:"A woman built the first university", p:"Fez, 859 CE: Fatima al-Fihri spent her inheritance to endow al-Qarawiyyin, recognized today as the oldest continuously operating degree-granting university on earth. It has been teaching for about 1,167 years without closing. Every campus in the world stands downstream of a Muslim woman's sadaqa jariyah."},
   {t:"read", h:"The engineer who shared everything", p:"Al-Jazari (d. 1206) wrote fifty machines into one illustrated book: water clocks, pumps, automata, with measurements and assembly steps so others could build them. His crank-and-connecting-rod, which turns rotation into push and pull, sits inside every engine ever made. He kept no secrets: knowledge, for him, was a water-wheel that exists to be turned for others."},
   {t:"read", h:"The man who walked the ummah", p:"Ibn Battuta left Tangier in 1325, aged 21, for Hajj, and kept going for about 29 years and roughly 117,000 km: West Africa to China, employed as a judge in Delhi, shipwrecked, robbed, honored, across a single connected civilization of caravanserais and masjids. His Rihla proved with footsteps how wide the ummah had grown."},
   {t:"tip", p:"Nine such lives are told in full, each with its own animated infographic, in the Teachers of the World gallery on the school page. Tap any tile there and meet them properly."}
  ],
  quiz:[
   {q:"Al-Qarawiyyin university was founded by:", a:["a sultan","Fatima al-Fihri, from her inheritance","a committee","Ibn Battuta"], c:1},
   {q:"Al-Jazari's crank mechanism converts:", a:["water into light","rotation into push and pull","heat into sound","nothing"], c:1},
   {q:"Ibn Battuta's journey lasted about:", a:["2 years","10 years","29 years","50 years"], c:2},
   {q:"What did al-Jazari do with his engineering knowledge?", a:["kept it secret","sold it to kings only","published it with build instructions for all","burned it"], c:2}
  ]},

{ id:"g4", name:"The healers · Ibn Sina & al-Zahrawi", mins:9,
  cards:[
   {t:"read", h:"Medicine as amanah", p:"Islam made healing a sacred trust early: for every disease there is a cure (Muslim 2204) was an invitation to go and find them. Two men answered it so thoroughly that Europe studied their books for half a millennium."},
   {t:"pairs", rows:[["Ibn Sina (980-1037)","the Canon of Medicine: five books ordering all known medicine; a standard European textbook into the 1600s"],["al-Zahrawi (936-1013)","al-Tasrif: 30 volumes; the last illustrated ~200 surgical instruments, many recognizable on modern trays"],["Catgut sutures","al-Zahrawis absorbable internal stitches: still the principle used today"],["The clinical method","observe the patient, record the case, doubt the ancients when the body disagrees"]]},
   {t:"read", h:"What the child takes from them", p:"Ibn Sina memorized the Quran by ten and treated a king as a teenager; his asked-for payment was a library. Al-Zahrawi insisted the surgeon must know anatomy before daring to cut. Between them: mastery begins with the Book, knowledge is the best wage, and competence is a form of mercy."},
   {t:"tip", p:"Their full illustrated lives, with animated infographics, open with one tap in the Teachers of the World gallery on the school page."}
  ],
  quiz:[
   {q:"The Canon of Medicine was written by:", a:["al-Zahrawi","Ibn Sina","al-Biruni","Ibn Battuta"], c:1},
   {q:"Al-Tasrifs famous final volume illustrated:", a:["maps","~200 surgical instruments","stars","coins"], c:1},
   {q:"Catgut sutures matter because they:", a:["look good","are absorbed by the body","are cheap","never existed"], c:1},
   {q:"For every disease, the hadith says, there is:", a:["a season","a cure","a price","a story"], c:1}
  ]}
]}

,

/* ============ TRACK 7 · TREASURES OF THE QURAN ============ */
{ id:"kitab", icon:"book", ar:"الْكِتَاب", name:"Treasures of the Quran",
  stage:"every age, forever", color:"#33507C",
  desc:"Five close readings of the surahs and ayat every Muslim lives inside: what they say, when they came, and how to carry them.",
  lessons:[

{ id:"q1", name:"Al-Fatiha · the conversation", mins:10,
  cards:[
   {t:"read", h:"The Mother of the Book", p:"Seven ayat recited at least seventeen times a day by every praying Muslim: no words in history are said more often. The Prophet ﷺ called it the greatest surah in the Quran (Bukhari 4474). It is at once praise, creed, plea and map: the whole Book folded into one page."},
   {t:"pairs", rows:[["Ayat 1-3 · praise","all praise to the Lord of the worlds, the Merciful, Master of the Day of Judgment"],["Ayah 4 · the pivot","You alone we worship, You alone we ask for help: the exact center, where praise turns to plea"],["Ayat 5-7 · the plea","guide us to the straight path: the path of those You favored"],["The answer","amin: O Allah, respond"]]},
   {t:"ayah", ref:"1:5", ar:"إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", en:"You alone we worship and You alone we ask for help. (1:5) The hinge of the whole surah, and of the whole religion."},
   {t:"read", h:"A divided conversation", p:"In a hadith qudsi, Allah says: I have divided the prayer between Myself and My servant... when he says all praise belongs to Allah, Allah says My servant has praised Me (Muslim 395), line by line to the end. The Fatiha is not recited AT Allah. It is answered, live, every single time. Pray tonight knowing each line gets a reply."}
  ],
  quiz:[
   {q:"A praying Muslim recites Al-Fatiha at least how often daily?", a:["5 times","17 times","3 times","70 times"], c:1},
   {q:"The pivot ayah at the surahs center is:", a:["Alhamdulillah","Iyyaka nabudu wa iyyaka nastain","Amin","Bismillah"], c:1},
   {q:"The hadith qudsi says the Fatiha is:", a:["too long","divided between Allah and His servant, answered line by line","only for scholars","optional"], c:1},
   {q:"Al-Fatiha is called:", a:["the Mother of the Book","the last surah","the hidden surah","the night surah"], c:0}
  ]},

{ id:"q2", name:"Ayat al-Kursi · the greatest ayah", mins:9,
  cards:[
   {t:"read", h:"One ayah above all", p:"The Prophet ﷺ asked Ubayy ibn Kab which ayah in Allahs Book is greatest. Ubayy answered: Ayat al-Kursi. The Prophet ﷺ struck his chest gently and said: congratulations on your knowledge (Muslim 810). One ayah, 2:255, and it holds the whole theology of Islam."},
   {t:"ayah", ref:"2:255", ar:"اللَّهُ لَا إِلَـٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ", en:"Allah: there is no god but Him, the Ever-Living, the Sustainer. Neither drowsiness overtakes Him nor sleep... (2:255, opening)"},
   {t:"pairs", rows:[["The Living, the Sustainer","needs nothing, sustains everything"],["No drowsiness, no sleep","the watch over you has no night shift"],["His Kursi embraces the heavens and the earth","and guarding them does not tire Him"],["Who can intercede except by His permission","no back doors, no rivals, no secrets from Him"]]},
   {t:"read", h:"How the believers use it", p:"After every obligatory prayer (its reciter has nothing between him and Paradise except death, an-Nasai, sahih), and before sleep, where it posts a guard from Allah until morning (Bukhari 2311). Memorize it this week: ten lines of Arabic that turn every bedtime into a fortress."}
  ],
  quiz:[
   {q:"Ayat al-Kursi is which ayah?", a:["1:1","2:255","36:1","112:1"], c:1},
   {q:"Al-Hayy al-Qayyum means:", a:["the First and Last","the Living, the Sustainer","the Merciful","the Judge"], c:1},
   {q:"Recited before sleep, it:", a:["does nothing","posts a guard until morning (Bukhari 2311)","replaces prayer","must be whispered"], c:1},
   {q:"Who named it the greatest ayah in the exchange with the Prophet ﷺ?", a:["Abu Bakr","Ubayy ibn Kab","Aisha","Umar"], c:1}
  ]},

{ id:"q3", name:"The three Quls · the refuge surahs", mins:9,
  cards:[
   {t:"read", h:"Three that begin with Say", p:"Al-Ikhlas (112), Al-Falaq (113) and An-Nas (114): the Quran closes with three commands to speak. The first states who Allah is; the last two place you in His refuge from every darkness outside you and inside you. Together they are the believers nightly armor and the easiest treasure to memorize first."},
   {t:"ayah", ref:"112:1", ar:"قُلْ هُوَ اللَّهُ أَحَدٌ", en:"Say: He is Allah, One. (112:1) The Prophet ﷺ swore it equals a third of the Quran (Bukhari 5013)."},
   {t:"pairs", rows:[["Al-Ikhlas","pure tawhid: One, Eternal, unbegotten, unequaled: a third of the Qurans meaning in four ayat"],["Al-Falaq","refuge with the Lord of daybreak from outer harms: darkness, envy, hidden evil"],["An-Nas","refuge with the Lord of mankind from the inner whisperer in the chests of men"],["The nightly sunnah","recite all three into cupped hands, blow gently, wipe over the body: three times (Bukhari 5017)"]]},
   {t:"read", h:"Why they are enough", p:"When the Prophet ﷺ was asked what to recite, he said: Say Qul huwa Allahu ahad and the two of refuge when you enter evening and morning, three times: they will suffice you against everything (Abu Dawud 5082, hasan sahih). Suffice: his word. Learn them with your children this month; they are eleven short ayat in total."}
  ],
  quiz:[
   {q:"Al-Ikhlas equals what portion of the Quran, by the Prophets ﷺ oath?", a:["a tenth","a half","a third","all of it"], c:2},
   {q:"Al-Falaq seeks refuge mainly from:", a:["inner whispers","outer harms like envy and darkness","hunger","travel"], c:1},
   {q:"An-Nas names the whisperer located:", a:["in the sky","in the chests of mankind","in the sea","in books"], c:1},
   {q:"The nightly sunnah with the three Quls involves:", a:["writing them","cupped hands, a gentle blow, wiping the body","shouting them","one recitation yearly"], c:1}
  ]},

{ id:"q4", name:"Ad-Duha & Ash-Sharh · the comfort surahs", mins:9,
  cards:[
   {t:"read", h:"When revelation went quiet", p:"Early in prophethood, revelation paused. The mockers sneered that Muhammads ﷺ Lord had abandoned him, and the pause pressed on his heart. Then dawn broke twice: two surahs, back to back, that read like a hand on a grieving shoulder. They were sent to one man in one sorrow, and they have been medicine for every sorrow since."},
   {t:"ayah", ref:"93:3", ar:"مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ", en:"Your Lord has not abandoned you, nor does He hate you. (93:3)"},
   {t:"pairs", rows:[["By the morning light (93:1)","the oath itself is the message: after every night, duha comes"],["Did He not find you an orphan and shelter you? (93:6)","your own past is the evidence of His care"],["So the orphan: do not oppress. The asker: do not repel. (93:9-10)","healed people heal people: comfort turns immediately into duty"],["With hardship comes ease: twice (94:5-6)","one hardship, two eases: the scholars noted the Arabic makes the ease outnumber the pain"]]},
   {t:"ayah", ref:"94:5", ar:"فَإِنَّ مَعَ الْعُسْرِ يُسْرًا", en:"So truly with hardship comes ease. (94:5) With it: not after it. The ease is already inside the hard day."},
   {t:"read", h:"How to use them", p:"These are the surahs for the heavy night: read slowly, in Arabic and your own tongue. Notice the method of divine comfort: an oath by light, proof from your own story, and then a task, because purpose is part of the cure. This is also the Madrasas model for consoling anyone: light, memory, duty."}
  ],
  quiz:[
   {q:"Ad-Duha answered:", a:["a battle","the pause in revelation and the mockery around it","a famine","a treaty"], c:1},
   {q:"93:3 promises:", a:["wealth","your Lord has not abandoned you nor hates you","long life","victory"], c:1},
   {q:"With hardship comes ease appears:", a:["once","twice in a row","seven times","never"], c:1},
   {q:"The comfort of Ad-Duha ends by turning into:", a:["silence","duty toward the orphan and the asker","celebration","poetry"], c:1}
  ]},

{ id:"q5", name:"Al-Asr & Al-Kawthar · the shortest, the deepest", mins:8,
  cards:[
   {t:"read", h:"Three ayat that grade every life", p:"Imam ash-Shafii said of Al-Asr: were people to reflect on this surah, it would suffice them. One oath, one verdict, one exception: by time itself, every human is in loss, except those with four things: iman, righteous deeds, counseling one another to truth, and counseling one another to patience. Four columns; a life missing one is leaking."},
   {t:"ayah", ref:"103:1", ar:"وَالْعَصْرِ ۝ إِنَّ الْإِنسَانَ لَفِي خُسْرٍ", en:"By time: indeed mankind is in loss... (103:1-2)"},
   {t:"read", h:"Al-Kawthar · abundance for the mocked", p:"The shortest surah in the Quran, three ayat, was sent when enemies called the Prophet ﷺ cut off after his sons died. Allahs answer: We have given you al-Kawthar, the abundance, including the river of Paradise he ﷺ described to his companions. So pray and sacrifice for your Lord: the one who mocks you is the one cut off (108:3). History complied: billions bless his name every day; his mockers survive only as footnotes inside his story."},
   {t:"ayah", ref:"108:1", ar:"إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ", en:"We have surely given you the Abundance. (108:1)"}
  ],
  quiz:[
   {q:"Al-Asr says every human is in loss except those with how many qualities?", a:["two","three","four","ten"], c:2},
   {q:"Which pair completes iman and good deeds in Al-Asr?", a:["wealth and health","counseling truth and counseling patience","travel and trade","fasting and hajj"], c:1},
   {q:"The shortest surah of the Quran is:", a:["Al-Asr","Al-Ikhlas","Al-Kawthar","An-Nas"], c:2},
   {q:"Al-Kawthar answered those who called the Prophet ﷺ:", a:["poor","cut off","foreign","young"], c:1}
  ]}
]},

/* ============ TRACK 8 · THE SEERAH ============ */
{ id:"seerah", icon:"lamp", ar:"السِّيرَة", name:"The Seerah",
  stage:"Observatory → Academy", color:"#8a6d1a",
  desc:"The life of the Messenger ﷺ in five movements: the world he entered, the call, the trial, the city, and the completion.",
  lessons:[

{ id:"s1", name:"Before the light · Makkah and the trustworthy youth", mins:10,
  cards:[
   {t:"read", h:"The world he ﷺ was born into", p:"Sixth-century Arabia: tribal war as a pastime, daughters buried alive, 360 idols crowding the House that Ibrahim built for One. Yet Makkah kept two treasures it did not deserve: the Kaaba, and a memory that Ibrahims religion had once been pure. Into this, in the Year of the Elephant (when Allah destroyed Abrahas army marching on the Kaaba: Surah 105), Muhammad ﷺ was born."},
   {t:"pairs", rows:[["Orphaned early","father before birth, mother at six, grandfather at eight: raised then by his uncle Abu Talib"],["The shepherd years","every prophet kept sheep: patience school for keeping people"],["The merchant","traded for the noblewoman Khadijah with such honesty that she proposed; their marriage lasted 25 years until her death"],["Al-Amin","the whole city called him the Trustworthy; when the tribes nearly fought over resetting the Black Stone, his cloak solution let every chief share the honor"]]},
   {t:"ayah", ref:"105:1", ar:"أَلَمْ تَرَ كَيْفَ فَعَلَ رَبُّكَ بِأَصْحَابِ الْفِيلِ", en:"Have you not seen how your Lord dealt with the army of the elephant? (105:1) The year of his birth carried its own sign."},
   {t:"read", h:"The retreat to Hira", p:"Wealthy enough to be idle, honored enough to be political, he ﷺ chose neither. He climbed to a cave called Hira to think about the One behind the idols nonsense. He was forty. He did not know he was about to meet an angel. The best preparation for revelation, it turns out, is an honest life and a thinking heart."}
  ],
  quiz:[
   {q:"The Prophet ﷺ was born in the year of:", a:["the flood","the Elephant","the drought","the eclipse"], c:1},
   {q:"Makkah called him al-Amin, meaning:", a:["the wealthy","the trustworthy","the poet","the chief"], c:1},
   {q:"The Black Stone dispute was solved by:", a:["a duel","his cloak carried by all chiefs together","a vote","abandoning the stone"], c:1},
   {q:"At forty he regularly retreated to:", a:["Taif","the cave of Hira","Yemen","the sea"], c:1}
  ]},

{ id:"s2", name:"Iqra · the cave and the first believers", mins:10,
  cards:[
   {t:"read", h:"The embrace of the angel", p:"In Ramadan, in the cave, Jibril came and said: Iqra, Read. I cannot read, he ﷺ answered. Three embraces, each tighter, and then the first five ayat of Surah al-Alaq descended: Read, in the name of your Lord who created (96:1). He ran home trembling: Cover me, cover me. Khadijah wrapped him and spoke words every anxious soul should memorize: Never. Allah will never disgrace you: you keep ties, carry the weak, host the guest, help the victims of calamity (Bukhari 3)."},
   {t:"ayah", ref:"96:1", ar:"اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ", en:"Read, in the name of your Lord who created. (96:1) The first revealed words: a command to learn, before any command to fight, fast or even pray."},
   {t:"pairs", rows:[["First believer","Khadijah, without a moments pause"],["First child","Ali, ten years old, raised in his house"],["First freed slave","Zayd ibn Harithah, who chose him over his own father"],["First outside the house","Abu Bakr, who never once called it impossible; through him came Uthman, Talha, Zubayr, Sad..."]]},
   {t:"read", h:"Three quiet years", p:"For about three years the call stayed private: hearts gathered one by one, prayer taught, the small community welded in secret. Then came the command to warn openly, beginning with his own clan (26:214). He stood on Safa and asked: if I told you an army waited behind this hill, would you believe me? Yes: they had never heard him lie. Then his uncle Abu Lahab cursed him publicly. The age of comfort was over."}
  ],
  quiz:[
   {q:"The first revealed word was:", a:["Pray","Read","Fast","Flee"], c:1},
   {q:"Khadijahs response to his fear was:", a:["doubt","Allah will never disgrace you, and she listed his character","silence","fear"], c:1},
   {q:"The private phase of the call lasted about:", a:["three months","three years","ten years","one week"], c:1},
   {q:"Makkah believed his warning claim on Safa because:", a:["he was armed","they had never heard him lie","he paid them","the chiefs ordered it"], c:1}
  ]},

{ id:"s3", name:"The trial years · boycott, Taif, and the night journey", mins:11,
  cards:[
   {t:"read", h:"When mockery became machinery", p:"Persecution escalated from insults to torture: Bilal under the boulder, Sumayyah the first martyr of Islam, killed for one word: Ahad. Some companions were sent to the just Christian king of Abyssinia: the first hijra. Then Makkah boycotted the Prophets ﷺ whole clan: three years in a barren valley, eating leaves, hearing children cry from hunger, until even the pagans grew ashamed and tore the pact."},
   {t:"read", h:"The Year of Sorrow and the stones of Taif", p:"Around the tenth year, Khadijah died and Abu Talib died: the shelter of the heart and the shelter of the tribe, gone in one year. He ﷺ walked to Taif to invite its people; they set street boys on him until his sandals ran with blood. The angel of the mountains offered to crush the city. His answer, bleeding: No: perhaps from their descendants will come those who worship Allah alone (Bukhari 3231). Every Muslim from Taif since is his answer still arriving."},
   {t:"ayah", ref:"17:1", ar:"سُبْحَانَ الَّذِي أَسْرَىٰ بِعَبْدِهِ لَيْلًا مِّنَ الْمَسْجِدِ الْحَرَامِ إِلَى الْمَسْجِدِ الْأَقْصَى", en:"Glory to Him who took His servant by night from the Sacred Mosque to the Farthest Mosque... (17:1)"},
   {t:"read", h:"Isra and Miraj · the gift after the grief", p:"After the hardest year came the highest honor: the night journey to Jerusalem, leading the prophets in prayer, then the ascent through the heavens to a nearness no creature had reached. From that night he ﷺ brought back the ummahs daily appointment: the five prayers. Note the order Allah teaches: the deepest consolations come after the emptiest years, and the gift he returned with was not comfort for himself but connection for us."}
  ],
  quiz:[
   {q:"The first martyr of Islam was:", a:["Bilal","Sumayyah","Hamza","Yasir"], c:1},
   {q:"The boycott of the Prophets clan lasted about:", a:["three weeks","three years","ten years","one year"], c:1},
   {q:"At Taif, offered the citys destruction, he ﷺ chose:", a:["revenge","hope for their descendants","exile for them","silence"], c:1},
   {q:"The five daily prayers were given during:", a:["Badr","the Miraj (the ascension)","the Hijra","the Farewell Hajj"], c:1}
  ]},

{ id:"s4", name:"The city of light · Hijra and building Madinah", mins:11,
  cards:[
   {t:"read", h:"The emigration", p:"When Yathribs tribes pledged protection, the believers slipped away in pairs until Makkah plotted to kill the Prophet ﷺ in his bed. Ali took the bed; the Prophet and Abu Bakr took the southern road, hid three days in the cave of Thawr: Do not grieve, Allah is with us (9:40), and arrived to a city singing. Yathrib became al-Madinah, and the calendar of Islam starts not from a birth or a victory, but from this migration: the day the community began."},
   {t:"pairs", rows:[["First deeds in Madinah","a masjid built (he ﷺ carried bricks himself), and the muakhah: each emigrant paired with a helper as brothers"],["The Sahifa","a written charter binding Muslim tribes and Jewish tribes into one defensive city: among historys earliest constitutions"],["Badr · Ramadan 2AH","313 ill-equipped believers against ~1000; victory that stunned Arabia (3:123)"],["Uhud · 3AH","archers left their post; near-defeat, 70 martyrs including Hamza: the ummahs permanent lesson that obedience outranks enthusiasm"]]},
   {t:"read", h:"The trench and the truce", p:"5AH: ten thousand besiegers ringed Madinah; on Salman al-Farisis counsel the Muslims dug a trench, and wind and division broke the siege without pitched battle (33:9). Then Hudaybiyyah: a truce that read like surrender and worked like victory: in the two calm years that followed, Islam roughly doubled: proof that the message wins wherever swords go quiet."},
   {t:"read", h:"The Prophet ﷺ at home", p:"Between these headlines lived the man: mending his own sandals, racing Aisha, stopping sermons when a child cried, teaching that the best of you are those best to their families (Tirmidhi 3895). The state he built never swallowed the gentleness he was. In this Madrasa, that is the leadership syllabus."}
  ],
  quiz:[
   {q:"The Islamic calendar begins from:", a:["the Prophets birth","the first revelation","the Hijra to Madinah","the conquest of Makkah"], c:2},
   {q:"In the cave of Thawr he ﷺ said:", a:["We are lost","Do not grieve, Allah is with us","Fight them","Turn back"], c:1},
   {q:"Uhuds lasting lesson came from:", a:["bad weather","archers leaving their assigned post","numbers","geography"], c:1},
   {q:"The trench strategy came from:", a:["Abu Bakr","Salman al-Farisi","Khalid","Bilal"], c:1}
  ]},

{ id:"s5", name:"Completion · the opening, the farewell, the passing", mins:11,
  cards:[
   {t:"read", h:"The bloodless opening", p:"8AH: Makkah broke the truce, and ten thousand believers marched. The city that tortured them lay at his ﷺ feet. Entering with his head bowed low on his camel, reciting Surah al-Fath, he asked the Quraysh: What do you suppose I will do with you? Then: Go, for you are free. Bilal, once tortured on this ground, climbed the Kaaba and called the adhan. The idols fell that day; almost no blood did."},
   {t:"ayah", ref:"110:1", ar:"إِذَا جَاءَ نَصْرُ اللَّهِ وَالْفَتْحُ ۝ وَرَأَيْتَ النَّاسَ يَدْخُلُونَ فِي دِينِ اللَّهِ أَفْوَاجًا", en:"When Allahs help comes, and the opening, and you see the people entering Allahs religion in crowds... (110:1-2)"},
   {t:"read", h:"The Farewell Sermon", p:"10AH, Arafah, before over a hundred thousand: your lives and property are sacred as this day; usury abolished; women a trust from Allah; no Arab above a non-Arab, no white above black, except by taqwa; I leave among you the Book of Allah. Then the ayah descended: This day I have perfected for you your religion (5:3), and strong men wept, understanding what completion implied."},
   {t:"read", h:"The heaviest morning", p:"In Rabi al-Awwal 11AH, with his head in Aishas lap, he ﷺ whispered: rather, the Highest Companion, and the light of the world went out. Umar drew his sword against the very news; Abu Bakr kissed the Prophets forehead, then spoke the sentence that steadied Islam forever: Whoever worshipped Muhammad, Muhammad has died. Whoever worships Allah, Allah is Ever-Living and never dies (Bukhari 3667), and recited 3:144. The Seerah ends; the sunnah, the Book, and the ummah he built carry the light from there: now including you."}
  ],
  quiz:[
   {q:"At the conquest of Makkah, the Quraysh received:", a:["exile","imprisonment","Go, for you are free","fines"], c:2},
   {q:"The Farewell Sermon declared superiority comes only by:", a:["lineage","wealth","taqwa","language"], c:2},
   {q:"This day I have perfected your religion is ayah:", a:["2:255","5:3","9:40","110:1"], c:1},
   {q:"Abu Bakrs steadying words taught the ummah to worship:", a:["no one","the Ever-Living Allah, not any man","the community","the past"], c:1}
  ]}
]}
]};
