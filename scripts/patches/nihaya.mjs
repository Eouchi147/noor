// NOOR content patches — Al-Nihaya (new ids 46–64)
// Sequence note: the Ten Signs are listed together in Muslim 2901 (Hudhayfah ibn Asid);
// their internal order is presented per the majority reading (Ibn Hajar and others),
// with the Sun-West + Dabba pairing fixed by Muslim 2941.
export default [

// ——— NEW NODE 46: The Signs Begin (Minor Signs) ———
{id:46, insert:{
period:"nihaya",
titleEn:"The Signs Begin — Ashrat as-Sa'a",
titleAr:"أشراط الساعة",
metric:"“Sent like these two”",
summary:"The Hour has a dossier: dozens of minor signs, opened the day the Messenger ﷺ was sent.",
pattern:"pattern-nihaya",
image:"assets/manuscripts/un6AP.jpg",
details:`The Prophet ﷺ raised two fingers, the index and the middle, and said: "I and the Hour have been sent like these two." The first sign of the end of the world was the arrival of its final Prophet. Everything after him is epilogue — an epilogue that has now run fourteen centuries, because the mercy of Allah stretches the interval while the signs quietly accumulate.

He ﷺ told {{c:c-hudhayfah|Hudhayfah}} everything: "The Prophet stood among us and did not leave anything that would happen until the Hour except that he mentioned it — those who memorized it, memorized it." The Codex gathers here the minor signs (al-alamat as-sughra) with their sources — the ones fulfilled, the ones unfolding, and the ones waiting.

Fulfilled and witnessed: {{n:45|his own death}} — "count six things before the Hour: the first, my death"; the conquest of Jerusalem under {{c:c-umar|Umar}}; the plague of Amwas; wealth so abundant a man wanders with his sadaqah finding no taker; the fitan that fell on the community like patches of dark night, beginning with the murder of {{c:c-uthman|Uthman}}; false prophets — "there will be thirty dajjals, each claiming to be a messenger of Allah," a line running from Musaylimah to every modern claimant.

Unfolding before every generation's eyes: the slave-girl gives birth to her mistress; the barefoot, naked shepherds of goats compete in raising tall buildings — the hadith of {{c:a-jibril|Jibril}}, delivered in the towers' own century as if addressed to it; knowledge is lifted by the death of scholars and ignorance settles; zina and riba spread; killing multiplies until the killer does not know why he killed; time contracts; markets draw close; every age thinks itself the last and is wrong by design — "the Hour will not come until…" is a ledger only Allah can close.

Still ahead, at the threshold of the Major Signs: the Euphrates uncovers a mountain of gold over which men slaughter each other, ninety-nine of every hundred dying, each saying "perhaps I will be the one who survives"; the land of the Arabs returns to meadows and rivers — the desert greening, a sign the satellites now photograph without reading; fire from the Hijaz that illuminates the necks of camels in Busra — witnessed in the great harra eruption of 654 AH, the historians of Madinah recorded.

The grammar of all of it: signs are mercy before they are threat. Each one is a knock — the Hour announcing itself in installments so that no soul can say it was ambushed. After the minor comes the major: and the major, he ﷺ said, come in quick succession, "like beads falling from a cut string." The string is cut at {{n:47|the Mahdi}}.`,
sequence:{phase:"Minor Signs", position:"The long prelude", note:"Dozens of signs across fourteen centuries — fulfilled, unfolding, and awaited"},
timeline:[
 {label:"His sending & his death ﷺ", detail:"“I and the Hour — like these two” · Bukhari 6504"},
 {label:"Jerusalem opened · plagues · abundance", detail:"The six of Bukhari 3176"},
 {label:"Fitan like patches of night", detail:"Muslim 118 — faith sold for the world"},
 {label:"30 false prophets", detail:"Bukhari 3609 · Muslim 157"},
 {label:"Shepherds compete in towers", detail:"Hadith of Jibril — Muslim 8"},
 {label:"Knowledge lifted · killing multiplies", detail:"Bukhari 80 · Muslim 157"},
 {label:"Euphrates' mountain of gold", detail:"Bukhari 7119 · Muslim 2894"},
 {label:"Arabia green again", detail:"Muslim 157 — meadows & rivers return"}],
facts:[
 {label:"Category",value:"Minor — al-sughra"},
 {label:"Count",value:"Dozens — hadith corpus"},
 {label:"First sign",value:"His sending ﷺ"},
 {label:"Fulfilled",value:"Many — documented"},
 {label:"Function",value:"Mercy: warning in installments"},
 {label:"Next",value:"Major signs — “beads off a string”"}],
quran:[
 {ref:"47:18",ar:"فَهَلْ يَنظُرُونَ إِلَّا السَّاعَةَ أَن تَأْتِيَهُم بَغْتَةً ۖ فَقَدْ جَاءَ أَشْرَاطُهَا",en:"Do they await other than the Hour, that it should come upon them suddenly? For its signs have already come."},
 {ref:"54:1",ar:"اقْتَرَبَتِ السَّاعَةُ وَانشَقَّ الْقَمَرُ",en:"The Hour has drawn near, and the moon has split."}],
hadith:[
 {text:"I and the Hour have been sent like these two — and he joined his index and middle fingers.",source:"Bukhari 6504 · Muslim 2951"},
 {text:"The Hour will not be established until the Euphrates uncovers a mountain of gold over which the people fight: of every hundred, ninety-nine are killed — each of them saying: perhaps I will be the one who survives.",source:"Bukhari 7119 · Muslim 2894"},
 {text:"The Hour will not come until the land of the Arabs returns to meadows and rivers.",source:"Muslim 157"},
 {text:"He did not leave anything that would happen until the Hour except that he mentioned it.",source:"Bukhari 6604 · Muslim 2891 (Hudhayfah)"}],
lessons:[
 "The countdown began at the sending, not at some future rupture — live accordingly",
 "Signs are read for readiness, never for date-setting: the Hour's time is His alone",
 "Every generation sees enough signs to wake — and few do; be of the few"],
connections:[45,47,48]
}},

// ——— NEW NODE 47: The Mahdi ———
{id:47, insert:{
period:"nihaya",
titleEn:"Al-Mahdi — The Rightly Guided",
titleAr:"المهدي",
metric:"Seven years of justice",
summary:"From the household of the Prophet ﷺ: a ruler who fills the earth with justice as it was filled with wrong.",
pattern:"pattern-nihaya",
image:"assets/manuscripts/izWIV.jpg",
details:`Before the darkness of {{n:48|the Dajjal}}, a dawn. The Prophet ﷺ promised: "If only one day of this world remained, Allah would lengthen that day until He sent in it a man from me — or from the people of my house — whose name agrees with my name and whose father's name agrees with my father's name; he will fill the earth with fairness and justice as it was filled with oppression and wrong."

His file in the authentic sunan is precise and sober. He is of the family of the Prophet ﷺ, of the line of {{c:c-fatimah|Fatimah}} — "the Mahdi is of my household, of the sons of Fatimah." His name: Muhammad ibn Abdillah. He does not descend from the sky and he works no required miracle; he is a man whom Allah rectifies in a single night — the tradition's phrase for a heart set right and a matter arranged. He rules seven years — "and the earth will be filled with justice"; wealth is distributed without counting: "In the last of my ummah there will be a caliph who scoops wealth by the handful and does not number it."

The scholars fixed his doctrinal weight carefully, and the Codex reproduces their honesty: he is not named in Bukhari and Muslim by the title "Mahdi," but his description there is unmistakable — "your imam from among you" behind whom {{n:49|Isa ibn Maryam}} prays; and the hadith of the khasf, in Sahih Muslim from Umm Salamah: an army will march against a man taking refuge at the House, "and when they are at a bayda' — an open plain of the earth — the earth will swallow them, their first and their last," a pursuer's army ending like {{n:19|Pharaoh's}}, mid-stride. Named narrations fill the sunan of Abu Dawud, Tirmidhi, and Ibn Majah with chains the muhaddithun graded to soundness; belief in the Mahdi is the settled position of Ahl as-Sunnah — held without hysteria, and without the centuries of pretenders the hadith of the thirty dajjals predicted as its counterfeit shadow.

The order of the end: under his banner the believers unite; the great battles (al-malahim) unfold; and while the Muslims prepare for prayer at dawn in Damascus, {{n:49|the son of Maryam descends}} — and the Mahdi, ruler of the earth's last just state, steps back from his own mihrab to offer the imamate to the prophet. Isa declines the prayer: "No — you lead; Allah has honored this ummah: none shall lead it but its own." The last empire of justice ends its first morning with a king who tried to give away his place. That is the measure of the man — and the Codex's answer to every false mahdi who reached for a throne instead.`,
sequence:{phase:"Threshold", position:"Before the Ten", note:"Unites the ummah in the generation of the Dajjal and the Descent"},
timeline:[
 {label:"Corruption fills the earth", detail:"The condition of his sending"},
 {label:"Rectified in a night", detail:"A man of Fatimah's line, name matching the Prophet's"},
 {label:"Pledge at the House", detail:"The khasf army swallowed at al-Bayda' — Muslim 2882"},
 {label:"Seven years of justice", detail:"Wealth uncounted · Abu Dawud 4285"},
 {label:"Dajjal emerges in his era", detail:"The final fitnah begins"},
 {label:"Isa descends & prays behind him", detail:"“Your imam from among you” — Bukhari 3449"}],
facts:[
 {label:"Line",value:"Ahl al-Bayt — via Fatimah"},
 {label:"Name",value:"Matches the Prophet's ﷺ"},
 {label:"Rule",value:"Seven years"},
 {label:"Wealth",value:"Given without counting"},
 {label:"In Sahihayn",value:"By description, not title"},
 {label:"Counterfeit",value:"30 dajjals claim his place"}],
quran:[
 {ref:"24:55",ar:"وَعَدَ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَعَمِلُوا الصَّالِحَاتِ لَيَسْتَخْلِفَنَّهُمْ فِي الْأَرْضِ",en:"Allah has promised those who believe among you and do righteous deeds that He will grant them succession upon the earth…"}],
hadith:[
 {text:"The Mahdi is of me: broad of forehead, prominent of nose. He will fill the earth with fairness and justice as it was filled with oppression and wrong, and he will rule seven years.",source:"Abu Dawud 4285 (graded hasan/sahih)"},
 {text:"The Mahdi is of my household, of the sons of Fatimah.",source:"Abu Dawud 4284 · Ibn Majah 4086"},
 {text:"An army will march against the House; when they are at a bayda' of the earth, it will swallow their first and their last.",source:"Muslim 2882 (Umm Salamah)"},
 {text:"How will you be when the son of Maryam descends among you — and your imam is from among you?",source:"Bukhari 3449 · Muslim 155"}],
lessons:[
 "Justice returns before the world ends — despair of history is not a Muslim doctrine",
 "The true Mahdi is known by justice and humility, not by claims; every claimant disproves himself",
 "Armies against the sanctuary end in the earth's own custody — the khasf is on the record"],
connections:[46,48,49]
}},

{id:48, replace:{
titleEn:"Ad-Dajjal — The Great Deceiver",
titleAr:"الدجال",
metric:"40 days · one like a year",
details:`"There is no trial between the creation of Adam and the rising of the Hour greater than the Dajjal." The Prophet ﷺ said it plainly — and added that every prophet warned his nation of the one-eyed liar, while he was given the details no prophet before him gave.

The dossier, assembled from Muslim's long narrations: a young man, ruddy, thick-set, his hair in tight curls; blind in his right eye, the eye "like a floating grape"; and written between his eyes ك ف ر — kafir — "which every believer will read, literate or not." Reading, at the end as at {{n:29|the beginning}}, belongs to faith, not to schooling. He is barred forever from two cities: {{n:36|Madinah}} and Makkah — angels stand at their passes; at his approach Madinah will shake three times and expel its hypocrites to him, the city sifting itself.

He emerges from the east — from Khurasan, by way of the gap between Sham and Iraq — "and works corruption right and left; O servants of Allah, hold fast!" His stay: "forty days — a day like a year, a day like a month, a day like a week, and the rest of his days like your days." The companions asked the question of a people who prayed: on the day like a year, will one day's prayers suffice? He said: "No — estimate for it its measure." The ummah that keeps its prayer schedule under a dilated sky cannot be deceived by a man who plays god.

For he will play god with props: he arrives with a paradise and a fire, rivers of water and mountains of bread; he commands the sky and it rains, the earth and it sprouts; he kills a young believer, splits him in two, walks between the halves, and revives him — and the young man laughs: "By Allah, I have never had more insight about you than today." The tradition names that youth the greatest martyr-witness of history. The rule he ﷺ gave: "His fire is a cool garden, and his garden is a fire" — at the end of time, appearances invert; whoever judges by the eye is already his.

Seventy thousand of the Jews of Isfahan follow him in Persian shawls; the terrified flee to the mountains; and the siege closes on the believers in Sham — until, at dawn prayer in Damascus, {{n:49|the minaret whitens}}.

Before all of that, he is already chained. The stunning hadith of {{c:e-jassasa|al-Jassasah}} — told to the Prophet ﷺ by the sea-traveler Tamim ad-Dari and retold by the Prophet from the minbar — has the crawling spy-beast of the island lead the sailors to a shackled colossus in a monastery, who interrogates them about the palm trees of Baysan, the lake of Tiberias, and "the prophet of the unlettered," and says: I am the Masih — and I am about to be released.

Protection is prescribed, not improvised — see the Shield box: the opening verses of al-Kahf, the fourfold refuge in every prayer, distance, and the knowledge that your Lord is not one-eyed and is not seen on earth before death.`,
sequence:{phase:"Major Signs", position:"1st of the Ten", note:"The greatest fitnah of history — Muslim 2946"},
timeline:[
 {label:"Chained on the island", detail:"Al-Jassasah hadith — Muslim 2942"},
 {label:"Emerges: Khurasan → Sham/Iraq gap", detail:"“Corruption right and left” — Muslim 2937"},
 {label:"40 days — first like a year", detail:"Prayers estimated by measure"},
 {label:"70,000 of Isfahan follow", detail:"Muslim 2944"},
 {label:"Barred from the Haramayn", detail:"Madinah shakes thrice — Bukhari 1881"},
 {label:"Kills & revives the youth", detail:"“I have never had more insight” — Bukhari 7132"},
 {label:"Ends at Ludd's gate", detail:"By the hand of Isa — Muslim 2937"}],
protection:[
 "Memorize the first ten verses of Surat al-Kahf — “whoever retains them is protected from the Dajjal” (Muslim 809)",
 "Seek refuge in the last tashahhud of every prayer: from the punishment of Jahannam and the grave, the trial of life and death, and the trial of the Masih ad-Dajjal (Muslim 588)",
 "Distance: “whoever hears of him, let him keep far from him” (Abu Dawud 4319)",
 "Creed: your Lord is not one-eyed — and no one sees his Lord until he dies (Muslim 169, 2931)"],
facts:[
 {label:"Rank",value:"Greatest fitnah ever"},
 {label:"Mark",value:"ك ف ر — read by every believer"},
 {label:"Eye",value:"Right — “a floating grape”"},
 {label:"Duration",value:"40 days, dilated"},
 {label:"Barred from",value:"Makkah & Madinah"},
 {label:"Followers",value:"70,000 of Isfahan"},
 {label:"End",value:"Gate of Ludd"}],
quran:[
 {ref:"18:1-2",ar:"الْحَمْدُ لِلَّهِ الَّذِي أَنزَلَ عَلَىٰ عَبْدِهِ الْكِتَابَ وَلَمْ يَجْعَل لَّهُ عِوَجًا",en:"Praise to Allah who sent down the Book upon His servant and allowed no crookedness in it — (the opening of the surah that shields from him)."},
 {ref:"40:57",ar:"لَخَلْقُ السَّمَاوَاتِ وَالْأَرْضِ أَكْبَرُ مِنْ خَلْقِ النَّاسِ",en:"The creation of the heavens and the earth is greater than the creation of mankind — (the proportion every false god fails)."}],
hadith:[
 {text:"There is no trial between the creation of Adam and the rising of the Hour greater than the Dajjal.",source:"Muslim 2946"},
 {text:"He is young, with curled hair, his eye floating… he will emerge from a gap between Sham and Iraq and work corruption right and left. O servants of Allah — hold fast.",source:"Muslim 2937 (an-Nawwas ibn Sam'an)"},
 {text:"Forty days: a day like a year, a day like a month, a day like a week… We said: will one day's prayers suffice in the day like a year? He said: No — estimate for it its measure.",source:"Muslim 2937"},
 {text:"There is no prophet but warned his nation of the one-eyed liar. He is one-eyed, and your Lord is not one-eyed — and between his eyes is written: kafir.",source:"Bukhari 7131 · Muslim 2933"},
 {text:"He comes with a paradise and a fire — and his fire is a paradise, and his paradise is a fire.",source:"Muslim 2934 · Bukhari 3338"}],
lessons:[
 "The last trial is epistemological: eyes lie, revelation does not",
 "Prayer keeps its measure even when time itself is distorted",
 "Protection was prescribed 14 centuries early — the believer is never unarmed",
 "Madinah expels its hypocrites in the shaking: crisis is a sieve"],
connections:[47,49,36]
}},

{id:49, replace:{
titleEn:"Descent of Isa — Ruhullah",
titleAr:"نزول عيسى",
metric:"The white minaret, Damascus",
details:`The siege is at its worst. The believers in Damascus are lining up for Fajr; the iqamah has been called; {{n:47|the imam}} steps forward. And then — the hadith of an-Nawwas in Sahih Muslim gives the descent in a single frame of cinema no tradition has matched: "Allah sends the Masih, son of Maryam: he descends at the white minaret, east of Damascus, in two saffron-dyed garments, his hands resting on the wings of two angels. When he lowers his head, it drips; when he raises it, drops fall from it like pearls."

The prophet whom {{n:23|his own nation's file}} left open — raised, not crucified — returns to close it. Not with a new religion: the scholars are unanimous, and the hadith explicit, that he descends as a just ruler of this ummah, by the law of this Qur'an — "and your imam is from among you." Offered the prayer, he declines the mihrab of the Mahdi: Allah has honored this community — none leads it but its own. The second-greatest prophet to walk the earth prays Fajr as a follower.

Then the work. "He will break the cross, kill the swine, and abolish the jizyah" — the symbols of his own deification dismantled by his own hand; no tribute remains because no religion but Islam remains to pay it, "and wealth will overflow until no one accepts it." And the Dajjal: at his scent, the hadith says, the deceiver dissolves "as salt dissolves in water" — but he is not permitted to melt away. Isa pursues him to the gate of Ludd and ends him with a spear: the false messiah dies at the hand of the true one, and he shows the believers his blood on the point. Every knot of the end-times inversion is untied at once: the one they claimed died on a cross returns to kill the one who claimed to be god.

His era is the earth's sabbath. The hadith of Muslim paints it in almost unbearable colors: security so total that "the lion lies with the camel, the leopard with the cattle, and children play with snakes"; the earth commanded to yield its blessing until a pomegranate feeds a company and a single milking suffices a clan; rancor, envy, and mutual hatred lifted — the diseases of {{n:4|the first murder}} finally cured. Then {{n:50|Yajuj and Majuj}} interrupt the sabbath, and he leads the believers to the mountain until Allah's own worms end what no army could.

He remains forty years, the sunan record, marries, and dies as every son of Adam dies — and the Muslims pray the janazah over the prophet whom the nations worshipped. Buried in the earth like {{n:2|his father Adam}}: the final, gentle refutation. The Prophet ﷺ, who loved him across the centuries, said: "I am the nearest of people to the son of Maryam; there is no prophet between me and him… and if you live to see him, give him my salam."`,
sequence:{phase:"Major Signs", position:"2nd of the Ten", note:"Descends in the Mahdi's era, at Fajr, mid-iqamah"},
timeline:[
 {label:"Fajr in Damascus", detail:"Iqamah called — the imam steps back"},
 {label:"Descent at the white minaret", detail:"Two angels' wings · saffron garments"},
 {label:"Prays behind the Mahdi", detail:"“None leads this ummah but its own”"},
 {label:"Dajjal melts, dies at Ludd", detail:"“As salt dissolves in water” — Muslim 2937"},
 {label:"Cross broken · swine ended · jizyah lifted", detail:"Bukhari 2222 · Muslim 155"},
 {label:"The earth's sabbath", detail:"Lion with camel · rancor lifted"},
 {label:"Yajuj & Majuj released", detail:"He shelters the believers at at-Tur"},
 {label:"40 years · death · janazah", detail:"Abu Dawud 4324"}],
facts:[
 {label:"Descends at",value:"White minaret, E. Damascus"},
 {label:"Garments",value:"Two, saffron-dyed"},
 {label:"First act",value:"Prays behind this ummah"},
 {label:"Kills Dajjal at",value:"Gate of Ludd"},
 {label:"Rule",value:"Justice by the Qur'an"},
 {label:"Stay",value:"40 years — then dies"},
 {label:"Creed point",value:"Servant & prophet — not god"}],
quran:[
 {ref:"4:159",ar:"وَإِن مِّنْ أَهْلِ الْكِتَابِ إِلَّا لَيُؤْمِنَنَّ بِهِ قَبْلَ مَوْتِهِ",en:"There is none of the People of the Book but will believe in him before his death."},
 {ref:"43:61",ar:"وَإِنَّهُ لَعِلْمٌ لِّلسَّاعَةِ فَلَا تَمْتَرُنَّ بِهَا",en:"And indeed, he is a sign of the Hour — so do not doubt it."}],
hadith:[
 {text:"He descends at the white minaret east of Damascus, in two saffron garments, his hands on the wings of two angels… every disbeliever who finds the scent of his breath dies, and his breath reaches as far as his sight.",source:"Muslim 2937"},
 {text:"By the One in whose hand is my soul: the son of Maryam is about to descend among you as a just judge — he will break the cross, kill the swine, and abolish the jizyah; and wealth will overflow until no one accepts it.",source:"Bukhari 2222 · Muslim 155"},
 {text:"How will you be when the son of Maryam descends among you and your imam is from among you?",source:"Bukhari 3449 · Muslim 155"},
 {text:"He will remain forty years, then die — and the Muslims will pray over him.",source:"Abu Dawud 4324"}],
lessons:[
 "History's greatest dispute — who Isa is — is settled by Isa, in person, in Islam's favor",
 "The prophet declines the imamate: honoring this ummah is heaven's own etiquette",
 "Every deification collapses at a janazah — the worshipped one is prayed over",
 "The sabbath of the earth is real: justice, not scarcity, is the planet's design condition"],
connections:[48,50,23,47]
}},

{id:50, replace:{
titleEn:"Yajuj & Majuj — The Flood of Men",
titleAr:"يأجوج ومأجوج",
metric:"“From every height they swarm”",
details:`Behind a barrier of iron and molten copper, sealed in the age of Dhul-Qarnayn, waits the third calamity of the Ten. The Qur'an tells the construction like an engineering report: the two mountains, the people who "could scarcely understand speech," the request, and the method — "Bring me sheets of iron… blow… bring me molten copper to pour over it." Then the builder's disclaimer, the sentence every empire forgets to write: "This is a mercy from my Lord; but when the promise of my Lord comes, He will make it level — and the promise of my Lord is ever true."

The Prophet ﷺ saw the first crack in his own lifetime — and woke from sleep with his face red: "Woe to the Arabs from an evil that has drawn near: today a gap has been opened in the barrier of Yajuj and Majuj like this," and he made a circle of his thumb and finger. Zaynab bint Jahsh asked the question that hangs over every age of outward strength: "O Messenger of Allah, will we be destroyed while the righteous are among us?" He said: "Yes — when filth prevails."

Their release is fixed in the sequence by Muslim 2937: in the era of {{n:49|Isa}}, after the Dajjal, Allah reveals to him: "I have brought out servants of Mine against whom no one has power to fight — so gather My servants to at-Tur." Then the flood of men: "from every height they swarm." The first companies drink the lake of Tiberias dry; the last say: there was once water here. They reach Jerusalem's mount and shoot their arrows at the sky, and the arrows return stained — "We have conquered the earth and the heaven," they conclude: the creature's arithmetic at its most complete and most wrong.

No army engages them. The prophet of Allah and his companions besieged on the mountain turn to du'a — and Allah ends the unfightable horde with the smallest soldiers in His inventory: naghaf, worms in their necks, "and they fall dead as one soul dies." The earth reeks; the believers cannot descend for the stench and the fat; so Allah sends birds with necks like camels to carry the corpses away, and a rain that washes the earth "until it is left like a mirror." Then the command to the soil: bring out your blessing — and a company shelters under one pomegranate's rind.

The Codex places the lesson beside {{n:7|the first Flood}}: water drowned the deniers then; a flood of humanity is dissolved by worms now. Scale has never once been the operative variable. "Until, when Yajuj and Majuj are opened, and they, from every height, swarm — and the true promise draws near…" The next verse is the Hour's own vocabulary; after them, the signs stop being events in the world and start being events in the sky.`,
sequence:{phase:"Major Signs", position:"3rd of the Ten", note:"Released in the era of Isa — no human force engages them"},
timeline:[
 {label:"Sealed by Dhul-Qarnayn", detail:"Iron & molten copper — 18:94-97"},
 {label:"The crack shown to him ﷺ", detail:"“Woe to the Arabs…” — Bukhari 3346"},
 {label:"Released — “from every height”", detail:"21:96 · in Isa's era"},
 {label:"Tiberias drunk dry", detail:"“There was once water here”"},
 {label:"Arrows at the sky", detail:"Returned stained — the final arrogance"},
 {label:"Naghaf in the necks", detail:"“They fall as one soul” — Muslim 2937"},
 {label:"Birds & the washing rain", detail:"Earth left like a mirror"}],
facts:[
 {label:"Barrier",value:"Iron + copper — Dhul-Qarnayn"},
 {label:"Nature",value:"Human hordes — sons of Adam"},
 {label:"Scale",value:"Drink a lake dry"},
 {label:"Engaged by",value:"No army — du'a at at-Tur"},
 {label:"Ended by",value:"Worms — in one night"},
 {label:"Cleanup",value:"Birds + rain like a mirror"}],
quran:[
 {ref:"21:96-97",ar:"حَتَّىٰ إِذَا فُتِحَتْ يَأْجُوجُ وَمَأْجُوجُ وَهُم مِّن كُلِّ حَدَبٍ يَنسِلُونَ وَاقْتَرَبَ الْوَعْدُ الْحَقُّ",en:"Until, when Yajuj and Majuj are opened and they swarm from every height — and the true promise draws near…"},
 {ref:"18:98",ar:"قَالَ هَٰذَا رَحْمَةٌ مِّن رَّبِّي ۖ فَإِذَا جَاءَ وَعْدُ رَبِّي جَعَلَهُ دَكَّاءَ",en:"He said: This is a mercy from my Lord; but when the promise of my Lord comes, He will level it."}],
hadith:[
 {text:"Today a gap has been opened in the barrier of Yajuj and Majuj like this — will we be destroyed while the righteous are among us? Yes, when filth prevails.",source:"Bukhari 3346 · Muslim 2880"},
 {text:"Allah reveals to Isa: I have brought out servants of Mine whom no one has power to fight — gather My servants to at-Tur… and Allah sends the naghaf in their necks and they fall dead as one soul.",source:"Muslim 2937"},
 {text:"Allah says: O Adam, send out the delegation of the Fire — of every thousand, nine hundred and ninety-nine… and the glad tiding: from Yajuj and Majuj are the mass, and from you (this ummah) one.",source:"Bukhari 3348 · Muslim 222 (their multitude)"}],
lessons:[
 "Barriers hold by mercy, not metallurgy — the builder said so in writing",
 "Righteous minorities do not indemnify corrupt majorities: “when filth prevails”",
 "Allah retires the world's greatest army with worms: power's last lesson in proportion"],
connections:[49,51,7]
}},

// ——— NEW NODE 51: Sun from the West ———
{id:51, insert:{
period:"nihaya",
titleEn:"The Sun Rises from the West",
titleAr:"طلوع الشمس من مغربها",
metric:"The door of tawbah closes",
summary:"One sunrise reversed — and the ledger of repentance closes for every soul that waited.",
pattern:"pattern-nihaya",
details:`Every morning since the first morning, the sun has asked permission and risen from its east. One morning it will not. The Prophet ﷺ read the cosmic mechanics into Surah Ya-Sin's line — "and the sun runs to a settled term" — and told Abu Dharr its destination: it prostrates beneath the Throne and seeks leave, and leave is granted; until the morning it is told: "Return whence you came." And it will rise from its setting-place, over a world that finally, unanimously, believes — one sunrise too late.

"The Hour will not be established until the sun rises from its west; and when it rises and the people see it, all of them together will believe — and that is when belief will not benefit a soul that did not believe before, or earn good in its belief." The Qur'anic clause the hadith unpacks is 6:158: the day one of your Lord's signs arrives, the account of intention is frozen. Not because mercy tired — the same Prophet ﷺ said: "Allah extends His hand by night to accept the repentance of the day's sinner, and extends His hand by day to accept the repentance of the night's sinner — until the sun rises from its west." Fourteen centuries of an open hand, renewed twice daily; the western sunrise is simply the hand closing on schedule, announced.

The scholars call this the first of the heavenly signs — the shift from history to cosmology. {{n:48|Dajjal}}, {{n:49|the Descent}}, {{n:50|the hordes}}: terrestrial, survivable, a matter of sides. This is neither. It is staged in the one theater no propaganda can reach, timed for the hour every human on earth checks: dawn. And its twin follows the same day or close upon it — Sahih Muslim pairs them: "The first of the signs (in this kind) to emerge is the rising of the sun from its west, and the emergence of {{n:52|the Beast}} upon the people in the forenoon; whichever of the two precedes, the other is close behind it."

The fiqh of this node is one word long: now. Every deferred tawbah in history is a bet that tonight is not the night and this dawn is not the dawn. The Codex sets this tile in the sequence like a sealed envelope with a known content and an unknown date — and quotes the hadith the door swings on: "Whoever repents before the sun rises from its west, Allah will accept his repentance."`,
sequence:{phase:"Major Signs", position:"4th of the Ten — first heavenly sign", note:"Paired with the Dabba: “whichever precedes, the other follows close” — Muslim 2941"},
timeline:[
 {label:"Nightly prostration beneath the Throne", detail:"“It asks leave — and is given leave” — Bukhari 3199"},
 {label:"The morning of refusal", detail:"“Return whence you came”"},
 {label:"Rises from the west", detail:"All mankind believes — at once"},
 {label:"The ledger closes", detail:"6:158 — intention frozen"},
 {label:"The Dabba follows", detail:"Same season — Muslim 2941"}],
protection:[
 "Repent tonight, not at the deadline: “Whoever repents before the sun rises from its west, Allah accepts his repentance” (Muslim 2703)",
 "The hand is extended twice daily — night for the day's sinner, day for the night's (Muslim 2759)"],
facts:[
 {label:"Kind",value:"First heavenly sign"},
 {label:"Effect",value:"Tawbah door closed"},
 {label:"Ayah",value:"6:158"},
 {label:"Paired with",value:"The Dabba — same season"},
 {label:"Mechanism",value:"Leave beneath the Throne refused"},
 {label:"Fiqh",value:"One word: now"}],
quran:[
 {ref:"6:158",ar:"يَوْمَ يَأْتِي بَعْضُ آيَاتِ رَبِّكَ لَا يَنفَعُ نَفْسًا إِيمَانُهَا لَمْ تَكُنْ آمَنَتْ مِن قَبْلُ",en:"The day some of your Lord's signs come, no soul will benefit from its faith if it had not believed before…"},
 {ref:"36:38",ar:"وَالشَّمْسُ تَجْرِي لِمُسْتَقَرٍّ لَّهَا ۚ ذَٰلِكَ تَقْدِيرُ الْعَزِيزِ الْعَلِيمِ",en:"And the sun runs to a settled term — that is the determination of the Mighty, the Knowing."}],
hadith:[
 {text:"The Hour will not be established until the sun rises from its west; when it rises and the people see it, all will believe — and that is when belief benefits no soul that did not believe before.",source:"Bukhari 4635 · Muslim 157"},
 {text:"Do you know where this sun goes? It runs until it prostrates beneath the Throne and asks leave… and a morning will come when it is told: Return whence you came.",source:"Bukhari 3199 · Muslim 159"},
 {text:"Allah extends His hand by night to accept the day-sinner's repentance, and by day for the night-sinner's — until the sun rises from its west.",source:"Muslim 2759"}],
lessons:[
 "Universal belief arrives one sunrise after it stopped counting — timing is the whole test",
 "Repentance has an expiry written in the sky, not in your calendar",
 "The sun's obedience is a daily sermon: it asks leave — do you?"],
connections:[50,52,46]
}},

{id:52, replace:{
titleEn:"Dabbat al-Ard — The Beast",
titleAr:"دابة الأرض",
metric:"It speaks to mankind",
summary:"A creature from the earth speaks to mankind — the verdict, announced in person.",
details:`"And when the word falls upon them, We will bring forth for them a creature from the earth speaking to them — because mankind was not certain of Our signs." One verse — an-Naml 27:82 — and one function: when the era of persuasion ends, the earth itself produces the announcer.

The Dabba is the strangest entry in the file of the Ten, and the Codex handles it exactly as the sources do: with certainty about its reality and restraint about its anatomy. What is certain: it is a dābbah — a moving land-creature; it emerges from the earth; it speaks to human beings in intelligible speech; and its message is the verdict clause of 27:82 — mankind's uncertainty about the signs is over, because a sign is now conversing with them. What the authentic corpus adds: its timing is welded to {{n:51|the western sunrise}} — "whichever of the two precedes, the other follows close behind" (Muslim 2941); and in the narration of the sunan and Musnad, it marks the people: the face of the believer brightened, the nose of the disbeliever stamped — society sorted visibly, so that commerce itself, the reports say, would run on "O believer" and "O disbeliever" as forms of address. The marking reports are graded below the Sahihayn, and the Codex says so — but their meaning matches the verse's function: after the Dabba, ambiguity is administratively over.

Classical exegesis asked every question the reader is asking — What species? What size? From where exactly? Makkah's Safa is named in reports — and the honest summary of Ibn Kathir's survey is: the Qur'an withheld the anatomy on purpose. A sign engineered for the age of certainty-by-laboratory: a specimen that cannot be classified, speaking a language that cannot be denied.

Its theological position is precise. The signs before it — {{n:48|Dajjal}}, {{n:49|Isa}}, {{n:50|the hordes}} — still ran on faith: you could be deceived, you could resist, you could choose. The two heavenly signs end the choosing season: the sun closes the door of tawbah, and the Dabba prints the results. Nothing in the sequence after it addresses the undecided, because after it there are none. The Qur'an's very next verse (27:83) is already the muster: "And the Day We gather from every nation a troop of those who denied Our signs…"

For the living reader, the Dabba's tile is a mirror-check: the mark it stamps is only the externalization of a mark being written now, choice by choice, on the face of the heart. {{n:57|The Trumpet}} is two nodes away.`,
sequence:{phase:"Major Signs", position:"5th of the Ten", note:"Twin of the western sunrise — Muslim 2941"},
timeline:[
 {label:"The word falls", detail:"Persuasion's era ends — 27:82"},
 {label:"Emergence in the forenoon", detail:"Paired with the sun-west — Muslim 2941"},
 {label:"It speaks", detail:"A sign that converses — deniability ends"},
 {label:"The marking (sunan reports)", detail:"Believer brightened · denier stamped"},
 {label:"Society sorted", detail:"“O believer… O disbeliever” as address"}],
facts:[
 {label:"Source verse",value:"27:82 — explicit"},
 {label:"Nature",value:"Land creature — unclassified"},
 {label:"Function",value:"Speech: the verdict announced"},
 {label:"Timing",value:"Welded to the sun-west"},
 {label:"Marking reports",value:"Sunan — below Sahihayn, noted"},
 {label:"After it",value:"No undecided remain"}],
quran:[
 {ref:"27:82",ar:"وَإِذَا وَقَعَ الْقَوْلُ عَلَيْهِمْ أَخْرَجْنَا لَهُمْ دَابَّةً مِّنَ الْأَرْضِ تُكَلِّمُهُمْ أَنَّ النَّاسَ كَانُوا بِآيَاتِنَا لَا يُوقِنُونَ",en:"And when the word falls upon them, We will bring forth for them a creature from the earth, speaking to them — that mankind was not certain of Our signs."}],
hadith:[
 {text:"The first of the signs to emerge is the rising of the sun from its west and the emergence of the Beast upon the people in the forenoon — whichever of them precedes the other, the other is close behind it.",source:"Muslim 2941"},
 {text:"Three, when they emerge, no soul benefits from its faith that had not believed before: the Dajjal, the Beast, and the rising of the sun from its west.",source:"Muslim 158"}],
lessons:[
 "Allah's signs escalate to match each age's mode of denial — the last one talks back",
 "Visible marking is only deferred honesty: hearts are being stamped now",
 "A sign you can interview is a mercy delivered too late to those who demanded it"],
connections:[51,53,48]
}},

{id:53, replace:{
titleEn:"Ad-Dukhan — The Smoke",
titleAr:"الدخان",
metric:"“A visible smoke” — 44:10",
summary:"The sky brings a visible smoke covering the people — and the plea arrives one node late.",
details:`"Then watch for the Day the sky brings a visible smoke, covering the people — this is a painful punishment. 'Our Lord, remove from us the punishment; indeed, we are believers.'" Surat ad-Dukhan holds the sign in four verses shaped like a dialogue: the sky produces; mankind pleads; and the answer arrives with the coldest question in the Qur'an — "How can there be reminder for them, when a clear Messenger already came to them, and they turned away?"

The Codex records the exegetical file with both of its layers, because the companions themselves held both. Ibn Mas'ud read the smoke as already fulfilled: the famine Quraysh suffered after the Prophet's ﷺ du'a, when a man looked at the sky and saw something like smoke from hunger — and he anchored it to the verse's continuation, "We will remove the punishment a little; you will revert." Others among the companions and the majority of later scholarship held the smoke to be a still-future sign of the Hour — and this is fixed by the hadith of Hudhayfah ibn Asid in Sahih Muslim, where the Prophet ﷺ counts the Ten and names the smoke among them, in the same breath as {{n:48|the Dajjal}} and {{n:51|the sun from the west}}. Both readings can stand: a near fulfillment as a specimen, a far fulfillment as the sign itself — a pattern the Qur'an uses elsewhere, and the Codex flags honestly rather than flattening.

As a sign of the End, its distinguishing feature is totality of exposure: "covering the people" — yughshan-nas, no bunker, no border, no altitude. The reports describe the believer affected as with a cold, while it settles on the denier — a physical event with a moral filter, like {{n:52|the Dabba's}} mark and unlike any natural catastrophe. Its position among the heavenly signs continues the sequence's logic: after the verdicts are printed, the atmosphere itself begins shutting down the stage.

The du'a embedded in the surah — "Our Lord, remove it; we believe" — is the sequence's recurring tragedy: right words, wrong tense. It is the plea of {{n:19|Pharaoh in the water}}, of the world at {{n:51|the western dawn}}, scheduled once more under a smoking sky. The Qur'an placed the correct timing of those exact words in every reader's hands, centuries in advance, at the price of reading them one node early.

After the smoke, the file of warnings is nearly closed: {{n:54|the earth begins to give way}} beneath the deniers' cities, and the sequence accelerates — beads, as he ﷺ said, falling from a cut string.`,
sequence:{phase:"Major Signs", position:"6th of the Ten", note:"Counted in Muslim 2901; near/far readings both preserved from the salaf"},
timeline:[
 {label:"The sky produces", detail:"“A visible smoke” — 44:10"},
 {label:"Total exposure", detail:"“Covering the people” — no shelter"},
 {label:"The plea", detail:"“Remove it — we believe” (44:12)"},
 {label:"The answer", detail:"“A clear Messenger already came” (44:13)"},
 {label:"Sequence accelerates", detail:"Beads off a cut string"}],
facts:[
 {label:"Surah",value:"44 — bears its name"},
 {label:"Coverage",value:"All mankind — yughsha"},
 {label:"Filter",value:"Believer: as a cold (reports)"},
 {label:"Ibn Mas'ud",value:"Near reading — the famine"},
 {label:"Muslim 2901",value:"Among the Ten — future"},
 {label:"Embedded du'a",value:"Right words, wrong tense"}],
quran:[
 {ref:"44:10-11",ar:"فَارْتَقِبْ يَوْمَ تَأْتِي السَّمَاءُ بِدُخَانٍ مُّبِينٍ يَغْشَى النَّاسَ ۖ هَٰذَا عَذَابٌ أَلِيمٌ",en:"Then watch for the Day the sky brings a visible smoke, covering the people — this is a painful punishment."}],
hadith:[
 {text:"It will not come until you see ten signs before it — and he mentioned the Smoke, the Dajjal, the Beast, the rising of the sun from its west, the descent of Isa son of Maryam, Yajuj and Majuj, and three landslides… and the last of that: a fire from Yemen driving the people to their gathering place.",source:"Muslim 2901 (Hudhayfah ibn Asid)"}],
lessons:[
 "Some pleas are archived in advance — the Qur'an prints tomorrow's regret today",
 "Signs with moral filters end the myth of neutral catastrophe",
 "Hold multi-layer readings honestly: the salaf did not flatten what revelation left layered"],
connections:[52,54,19]
}},

{id:54, replace:{
titleEn:"Three Landslides — Al-Khusuf",
titleAr:"الخسوف الثلاثة",
metric:"East · West · Arabia",
details:`Among the Ten counted in Sahih Muslim: "three khusuf — a landslide in the East, a landslide in the West, and a landslide in the Peninsula of the Arabs." Khasf is the Qur'an's own verb for the ground withdrawing its permission: the earth does not strike like a quake; it opens and takes.

The Path has met the verb before, and the Codex links the file deliberately. It is what ended Qarun, mid-procession, in the fullness of his treasure: "So We caused the earth to swallow him and his home." It is the standing threat the Qur'an poses to every reader's false security: "Do you feel secure that He who is above the sky will not cause the earth to swallow you as it sways?" And it is the fate already written for one end-times army — {{n:47|the force marching against the House}}, swallowed "first and last" at a plain called al-Bayda (Muslim 2882). The three great landslides of the End are that same verb conjugated at continental scale: East, West, and — the detail that must have stunned the first audience — the Arabian Peninsula itself, the land of the sanctuaries, exempted from nothing except what Allah exempts.

The sources leave the three sites unnamed beyond their compass points, and the Codex refuses to invent coordinates. What the tradition does specify is the moral mechanics, given in the Prophet's ﷺ answer about the swallowed army: among them are the coerced and the mere bystander — "they are swallowed together, then raised on the Day of Resurrection according to their intentions." The khasf sorts nothing on the surface; the sorting happens at the resurrection. Presence in a caravan of wrong is itself a position, and the earth files no exemptions for the merely adjacent.

Placed here, seventh through ninth of the Ten, the landslides mark the sequence's turn from address to dismantling: the {{n:53|smoke}} filled the air, and now the floor itself begins to be withdrawn, in three announcements, on three horizons — as if creation were being struck like a tent, corner by corner. One sign remains on the earth's own ledger: {{n:56|the fire that gathers}}. After that, the sky takes over the file entirely at {{n:57|the Trumpet}}.

For the living reader the tile's question is Qarun's and the army's at once: what are you standing on, and in whose caravan are you standing? The ground's permission is a loan, renewed silently every morning — and among the Ten are three mornings when, in three places, it will not be renewed.`,
sequence:{phase:"Major Signs", position:"7th–9th of the Ten", note:"Three of the Ten in one tile — East, West, Arabia (Muslim 2901)"},
timeline:[
 {label:"Khasf in the East", detail:"The ground withdraws — site unnamed"},
 {label:"Khasf in the West", detail:"Second horizon answers"},
 {label:"Khasf in Arabia", detail:"The Peninsula itself — no geographic immunity"},
 {label:"Precedent: Qarun", detail:"28:81 — swallowed with his house"},
 {label:"Precedent: the army", detail:"Al-Bayda — Muslim 2882"},
 {label:"Sorting deferred", detail:"“Raised according to their intentions”"}],
facts:[
 {label:"Count",value:"3 of the Ten"},
 {label:"Verb",value:"Khasf — the Qur'an's own"},
 {label:"Sites",value:"Unnamed — compass only"},
 {label:"Precedents",value:"Qarun · the Bayda army"},
 {label:"Moral rule",value:"Raised by intentions"},
 {label:"Next on earth's ledger",value:"The gathering fire"}],
quran:[
 {ref:"67:16",ar:"أَأَمِنتُم مَّن فِي السَّمَاءِ أَن يَخْسِفَ بِكُمُ الْأَرْضَ فَإِذَا هِيَ تَمُورُ",en:"Do you feel secure that He who is above the sky will not cause the earth to swallow you as it sways?"},
 {ref:"28:81",ar:"فَخَسَفْنَا بِهِ وَبِدَارِهِ الْأَرْضَ",en:"So We caused the earth to swallow him and his home."}],
hadith:[
 {text:"…and three landslides: a landslide in the East, a landslide in the West, and a landslide in the Peninsula of the Arabs.",source:"Muslim 2901"},
 {text:"They will be swallowed, their first and their last… among them the coerced and the passer-by — they are destroyed together and raised according to their intentions.",source:"Muslim 2882 · cf. Bukhari 2118"}],
lessons:[
 "The ground is a permission, not a possession",
 "Adjacency to wrong is a stance — the earth takes caravans whole",
 "Immunity by geography ends: even the Peninsula is served notice"],
connections:[53,55,47]
}},

{id:55, replace:{
titleEn:"The Gentle Wind — Souls of the Believers",
titleAr:"الريح الطيبة",
metric:"Softer than silk",
details:`Between the terrors, the tradition sets down one sign that is pure tenderness — and one of the most misunderstood mercies in the sequence. After {{n:49|Isa's}} decades of justice, after the last great believers have rebuilt the world, Allah closes the account of faith on earth in person: "Allah will send a wind from the direction of Yemen, softer than silk, and it will not leave anyone in whose heart is a grain's weight of faith but it takes him."

Softer than silk. The instrument that harvests every believing soul from the planet is described in the vocabulary of a caress. In the narration of Abdullah ibn Amr in Sahih Muslim the wind comes after Isa's era and takes the believers under their armpits — the gesture of a parent lifting a child — "and there will remain the worst of people, in the lightness of birds and the savagery of beasts: they recognize no good and reject no evil." The Prophet ﷺ fixed the demographic consequence in a sentence that reorders everything the religious imagination expects of the apocalypse: "The Hour will not rise except upon the worst of creation." And its mirror: "The Hour will not rise while anyone on earth says: Allah, Allah."

The Codex pauses on the doctrine inside the mercy. The believer is not scripted into the final horror. The Trumpet, the panic, the leveling — none of it is addressed to faith; faith has been evacuated first, the way {{n:6|Nuh}} was boarded before the water and {{n:14|the family of Yusuf}} was seated before the famine's end. Whoever dies in that wind dies in the era of victory, after the vindication of everything believed through fourteen dark centuries. The end of the world, in Islam, is a posthumous event for the ummah.

It also finalizes the answer to history's oldest anxiety — is goodness losing? The sequence says: goodness is withdrawn, not defeated. The world does not overpower the believers; it is denied them, the way a host clears the table only after the guests have left. What remains — the bird-light, beast-savage remnant — inherits exactly one asset: the planet, for a moment, with no one left to warn them. Upon them the fire of {{n:56|the next node}} converges, and for them alone {{n:57|the Trumpet}} sounds in terror.

Every generation's believers asked their scholars: will we have to face the Hour? This tile is the tradition's answer, and it is gentle: no. You will face a breeze.`,
sequence:{phase:"Withdrawal", position:"After Isa's era", note:"Every believing soul taken — the Hour finds only the worst"},
timeline:[
 {label:"The world after Isa", detail:"Justice completed — faith vindicated"},
 {label:"Wind from Yemen", detail:"Softer than silk — Muslim 117"},
 {label:"Every believer taken", detail:"“A grain's weight of faith” suffices"},
 {label:"“Allah, Allah” unsaid", detail:"Muslim 148 — remembrance ends"},
 {label:"The worst remain", detail:"Bird-light, beast-savage — Muslim 2940"}],
facts:[
 {label:"Texture",value:"Softer than silk"},
 {label:"Threshold",value:"A grain's weight of faith"},
 {label:"Gesture",value:"Taken “under the armpits”"},
 {label:"Who remains",value:"The worst of creation"},
 {label:"Doctrine",value:"The Hour skips the believers"},
 {label:"Direction",value:"From Yemen (and Sham, in reports)"}],
quran:[
 {ref:"89:27-28",ar:"يَا أَيَّتُهَا النَّفْسُ الْمُطْمَئِنَّةُ ارْجِعِي إِلَىٰ رَبِّكِ رَاضِيَةً مَّرْضِيَّةً",en:"O reassured soul — return to your Lord, well-pleased and pleasing."}],
hadith:[
 {text:"Allah will send a wind from Yemen, softer than silk — it will not leave anyone in whose heart is a grain's weight of faith but it takes him.",source:"Muslim 117"},
 {text:"The Hour will not rise while anyone on earth says: Allah, Allah.",source:"Muslim 148"},
 {text:"…and there remain the worst of people, light as birds and savage as beasts — recognizing no good, rejecting no evil… and upon them the Hour rises.",source:"Muslim 2940 (Abdullah ibn Amr)"}],
lessons:[
 "The apocalypse is not addressed to the believers — mercy evacuates before wrath performs",
 "Goodness is withdrawn from the world, never defeated by it",
 "Die with a grain of faith and the end of everything is, for you, a breeze"],
connections:[49,56,64]
}},

{id:56, replace:{
titleEn:"Fire from Yemen — The Gathering Drive",
titleAr:"نار الحشر",
metric:"Last of the Ten",
details:`The hadith of the Ten closes its list with a note of finality: "and the last of that — a fire emerging from Yemen, driving the people to their place of gathering." After the {{n:55|gentle wind}} has emptied the earth of faith, the remnant world receives its final logistics order, written in flame.

The narrations in the Sahihayn give the operation's texture. It is a herding, not a massacre: the fire "gathers" — tahshur — moving mankind as drovers move herds, "halting with them when they halt at night, resting when they rest at midday." Anas ibn Malik carried the Prophet's ﷺ answer to Abdullah ibn Salam's questions: "The first of the signs of the Hour is a fire that gathers the people from the East to the West." And in Bukhari's wording of the general muster: mankind will be gathered on three modes — "desiring and fearing; two on a camel, three on a camel, ten on a camel; and the rest gathered by the fire, which camps with them where they camp and rises with them where they rise." Civilization's last migration, at walking pace, in mixed transport, with fire for a rearguard.

The scholars parsed "first of the signs" in Anas's hadith against the sequence carefully — first of the signs whose kind is pure gathering, the hinge between the world's signs and the Hereafter's operations — and the Codex preserves their precision rather than a false neatness: this fire is the last event of the old geography. Its terminus, the reports state, is the land of Sham — the earth's oldest prophetic corridor, {{n:9|Ibrahim's}} destination, {{n:31|the Isra's}} first leg, {{n:49|the Descent's}} stage — now the assembly area for the species. "Sham is the land of the muster," the Prophet ﷺ told his companions when they asked where to stand.

There is a mercy folded even into this tile, and the Codex refuses to lose it: those driven are those who remained after every door had been held open — after {{n:46|centuries of minor signs}}, after {{n:48|the Dajjal's}} exposure, after {{n:49|a prophet's forty-year reign}}, after {{n:51|a reversed sunrise}}, after {{n:52|a talking sign}}, after {{n:53|the smoke's}} rehearsal of their own plea. The fire drives no one who was not first invited by everything else.

With mankind assembled on the plain of Sham, the old universe has one appointment left. Somewhere above, {{c:a-israfil|Israfil}} has been watching the Throne, cheek inclined, since before these signs began. {{n:57|The next node}} is the sound the creation was built to end on.`,
sequence:{phase:"Major Signs", position:"10th — the last of the Ten", note:"“The last of that: a fire from Yemen driving the people to their gathering” — Muslim 2901"},
timeline:[
 {label:"Emerges from Yemen", detail:"After the wind — the remnant world"},
 {label:"Herds, not burns", detail:"Camps when they camp — Bukhari 6522"},
 {label:"Three modes of travel", detail:"Desiring · fearing · shared camels"},
 {label:"Terminus: Sham", detail:"“The land of the muster”"},
 {label:"Stage set", detail:"Mankind assembled — the Trumpet next"}],
facts:[
 {label:"Position",value:"Last of the Ten"},
 {label:"Verb",value:"Tahshur — it gathers"},
 {label:"Pace",value:"Halts when they halt"},
 {label:"Terminus",value:"The land of Sham"},
 {label:"Who is driven",value:"Only the post-wind remnant"},
 {label:"Next",value:"The Trumpet"}],
quran:[
 {ref:"50:44",ar:"يَوْمَ تَشَقَّقُ الْأَرْضُ عَنْهُمْ سِرَاعًا ۚ ذَٰلِكَ حَشْرٌ عَلَيْنَا يَسِيرٌ",en:"The Day the earth splits from them, hastening — that is a gathering easy for Us."}],
hadith:[
 {text:"…and the last of that: a fire emerging from Yemen, driving the people to their place of gathering.",source:"Muslim 2901"},
 {text:"The first of the signs of the Hour is a fire that gathers the people from the East to the West.",source:"Bukhari 3329 (Abdullah ibn Salam's questions)"},
 {text:"The people will be gathered in three ways… and the rest gathered by the fire: it camps with them where they camp and rests with them where they rest.",source:"Bukhari 6522 · Muslim 2861"}],
lessons:[
 "The last invitation is compulsory — but only for those who declined every voluntary one",
 "Sham's centrality runs the whole Path: from Ibrahim's hijrah to mankind's final address",
 "Even wrath keeps a herdsman's patience: the fire walks at the pace of the driven"],
connections:[55,57,31]
}},

{id:57, replace:{
titleEn:"The Trumpet — Two Blasts",
titleAr:"النفخ في الصور",
metric:"Forty between them",
summary:"Two blasts: all fall dead except whom Allah wills — then, at once, standing and looking on.",
details:`He ﷺ was asked how he could laugh at all, and answered with the posture of the angel: "How can I be at ease, when the bearer of the Horn has put the Horn to his mouth, inclined his forehead, and turned his ear, waiting for the command to blow?" {{c:a-israfil|Israfil}} has been in position since the Codex's earliest tiles. Every node of this Path has run inside the interval of one held breath.

The first blast is as-Sa'q — the stunning. "And the Horn will be blown, and whoever is in the heavens and whoever is on the earth will fall dead — except whom Allah wills." The sound reaches the man at his ordinary business with no margin for endings: "The Hour will rise while two men have spread a garment between them — they will not conclude the sale nor fold it. The Hour will rise while a man carries the milk of his camel — he will not taste it. The Hour will rise while a man raises his morsel to his mouth — he will not eat it." Bukhari's wording is a triptych of interrupted mid-motions: commerce, provision, appetite — the world stopped between intention and act.

Then the universe is retired with the fullest quietness in the Qur'an: the earth "a level plain — no crookedness will you see in it, nor any curve"; the mountains carded like wool, then vanished like a mirage; the heavens folded "as the scribe folds the scrolls" — and the King's question rings across a cosmos with no one left to answer it: "To whom belongs the sovereignty today?" — and He answers Himself: "To Allah, the One, the Prevailing."

Between the two blasts: forty. Abu Hurayrah, pressed by his students — forty days? forty months? forty years? — refused three times: "I decline to say." The gap is measured in a unit deliberately withheld; the dead are outside time's jurisdiction. In that interval, the hadith continues, a rain descends from the sky "and they sprout as herbs sprout." For everything of the human body decays "except one bone — the coccyx, ajb adh-dhanab; from it the creation is assembled on the Day of Resurrection." The species that was first built from clay keeps, by design, a seed crystal for the rebuild.

Then the second blast — the Rising: "Then it will be blown again, and at once they are standing, looking on." The Prophet ﷺ added a detail of his own station in that scene, sealed with characteristic humility: "Do not prefer me over the prophets, for the people will be stunned on the Day of Resurrection and I will be the first to recover — and behold, Musa is holding one of the pillars of the Throne; I do not know whether he recovered before me, or was compensated by his stunning at {{n:20|Tur}}." Even resurrection morning, in his telling, is a courtesy between brothers.

The dead of all ages stand up into {{n:58|one morning}} with no night behind it.`,
sequence:{phase:"Al-Qiyamah", position:"The hinge of existence", note:"39:68 — two blasts; “forty” between, unit withheld"},
timeline:[
 {label:"Israfil inclined — since creation", detail:"“He has put the Horn to his mouth” — Tirmidhi 2431"},
 {label:"Blast I: as-Sa'q", detail:"All fall dead — except whom He wills"},
 {label:"The world mid-motion", detail:"The sale, the milk, the morsel — Bukhari 6506"},
 {label:"Cosmos folded", detail:"Mountains as wool · scrolls rolled — 21:104"},
 {label:"“Forty” — unit withheld", detail:"Abu Hurayrah declined thrice — Bukhari 4935"},
 {label:"The rain · the coccyx-seed", detail:"“They sprout as herbs sprout”"},
 {label:"Blast II: the Rising", detail:"“At once they stand, looking on” — 39:68"}],
facts:[
 {label:"Instrument",value:"As-Sur — the Horn"},
 {label:"Bearer",value:"Israfil — already inclined"},
 {label:"Blasts",value:"Two: stun & raise"},
 {label:"Between",value:"“Forty” — unit withheld"},
 {label:"Rebuild seed",value:"Ajb adh-dhanab"},
 {label:"Survivors of Blast I",value:"“Except whom Allah wills”"}],
quran:[
 {ref:"39:68",ar:"وَنُفِخَ فِي الصُّورِ فَصَعِقَ مَن فِي السَّمَاوَاتِ وَمَن فِي الْأَرْضِ إِلَّا مَن شَاءَ اللَّهُ ۖ ثُمَّ نُفِخَ فِيهِ أُخْرَىٰ فَإِذَا هُمْ قِيَامٌ يَنظُرُونَ",en:"And the Horn will be blown, and all in the heavens and earth will fall dead except whom Allah wills; then it will be blown again — and at once they are standing, looking on."},
 {ref:"21:104",ar:"يَوْمَ نَطْوِي السَّمَاءَ كَطَيِّ السِّجِلِّ لِلْكُتُبِ",en:"The Day We fold the heaven like the folding of scrolls…"}],
hadith:[
 {text:"How can I be at ease when the bearer of the Horn has put it to his mouth, inclined his forehead, and awaits the command? They said: What shall we say? He said: Say — Allah is sufficient for us and the best Disposer of affairs.",source:"Tirmidhi 2431 (hasan)"},
 {text:"The Hour will rise while two men spread a garment between them and do not conclude the sale… while a man lifts his morsel and does not eat it.",source:"Bukhari 6506"},
 {text:"Between the two blasts is forty. They said: Forty days? He declined. Forty months? He declined. Forty years? He declined… then a rain descends and they sprout as herbs sprout. Everything of man decays except one bone — the coccyx; from it creation is assembled.",source:"Bukhari 4935 · Muslim 2955"}],
lessons:[
 "The Horn is already at the lip — every plan is drafted inside a held breath",
 "The world ends mid-gesture: finish the deed that should not be interrupted",
 "Annihilation and resurrection are equally effortless to Him — one breath each"],
connections:[56,58,1]
}},

{id:58, replace:{
titleEn:"Al-Ba'ath — The Rising",
titleAr:"البعث",
metric:"“As We began — We repeat”",
details:`The graves of every century open into the same morning. "The Day the earth splits from them, hastening — that is a gathering easy for Us." The first face out of the soil is known by name: "I am the first for whom the earth will split," the Prophet ﷺ said — adding, with the humility that marks every one of his precedence-hadiths, the caveat about Musa at the Throne. First out, and first to recover from the stun of the second blast.

The condition of the risen is described with an exactness that startled its first hearer: "You will be gathered barefoot, naked, and uncircumcised." {{c:c-aisha|Aisha}} asked the immediate human question — men and women together, looking at one another? He answered: "O Aisha, the matter is more severe than that they should look at one another." The Day's gravity is the world's oldest cure for the world's oldest distraction. As {{n:2|Adam}} arrived: no fabric, no rank, no adornment — creation restored to factory state, "as We began the first creation, We repeat it — a promise upon Us; indeed, We will do it."

The Qur'an's standing argument for the possibility of this morning is a rhyme of beginnings: He who assembled you from a drop the first time has kept the pattern; He who revives the dead land each spring has been rehearsing in front of you annually. "Does man think We will not assemble his bones? Rather — We are able to reshape his fingertips": the verse selects, with forensic precision, the one feature modernity would later discover to be unrepeatable. And the seed is on file: {{n:57|the coccyx}}, from which the body knits back "as herbs sprout."

The first dressed is not this ummah's Prophet, and he ﷺ announced it with pleasure: "The first of creation to be clothed on the Day of Resurrection is {{n:9|Ibrahim}}" — the man once stripped for the catapult, robed before the worlds. Then the drawing of station begins: some faces radiant, some dust-covered; some taking records in the right hand — the Day's entire bureaucracy already sorting itself as the plain fills.

They rise saying what the sleepers of every age would say — "Who has raised us from our resting place?" — and the answer stands already printed in the Book they ignored: "This is what the Most Merciful promised, and the messengers told the truth." No new information is issued on the Day; it is entirely a morning of old information coming true.

The plain fills, the sun descends to {{n:59|a mile's height}}, and the longest standing begins.`,
sequence:{phase:"Al-Qiyamah", position:"After the second blast", note:"“As We began the first creation, We repeat it” — 21:104"},
timeline:[
 {label:"The earth splits", detail:"He ﷺ first — “and behold, Musa at the Throne”"},
 {label:"Barefoot, naked, uncircumcised", detail:"“The matter is more severe…” — Bukhari 6527"},
 {label:"Reassembled from the seed", detail:"Coccyx · fingertips — 75:4"},
 {label:"Ibrahim clothed first", detail:"Bukhari 3349"},
 {label:"Faces sort themselves", detail:"Radiant · dust-covered — 80:38-41"},
 {label:"To the plain", detail:"The Standing begins"}],
facts:[
 {label:"First raised",value:"Muhammad ﷺ"},
 {label:"State",value:"As created — nothing added"},
 {label:"Proof cited",value:"Fingertips — 75:4"},
 {label:"First clothed",value:"Ibrahim"},
 {label:"Aisha's question",value:"Answered by severity"},
 {label:"Information new?",value:"None — all was foretold"}],
quran:[
 {ref:"75:3-4",ar:"أَيَحْسَبُ الْإِنسَانُ أَلَّن نَّجْمَعَ عِظَامَهُ ۝ بَلَىٰ قَادِرِينَ عَلَىٰ أَن نُّسَوِّيَ بَنَانَهُ",en:"Does man think We will not assemble his bones? Rather — We are able to reshape his fingertips."},
 {ref:"36:52",ar:"قَالُوا يَا وَيْلَنَا مَن بَعَثَنَا مِن مَّرْقَدِنَا ۜ ۗ هَٰذَا مَا وَعَدَ الرَّحْمَٰنُ وَصَدَقَ الْمُرْسَلُونَ",en:"They will say: Woe to us — who has raised us from our resting place? This is what the Most Merciful promised, and the messengers told the truth."}],
hadith:[
 {text:"You will be gathered barefoot, naked, and uncircumcised. Aisha said: Men and women, looking at one another? He said: O Aisha, the matter is more severe than that they should look at one another.",source:"Bukhari 6527 · Muslim 2859"},
 {text:"I am the first for whom the earth will split… and I do not know whether Musa recovered before me or was compensated by his stunning at at-Tur.",source:"Bukhari 2412 · Muslim 2373"}],
lessons:[
 "You will attend the Day exactly as you arrived in the world — bring only deeds",
 "The resurrection is a repeat performance: the first creation was the proof",
 "The Day publishes nothing new — it verifies what was always in the Book"],
connections:[57,59,2,9]
}},

{id:59, replace:{
titleEn:"Al-Hashr — The Standing",
titleAr:"الحشر والموقف",
metric:"Sun at a mile · 50,000 years",
details:`One plain, every human being who ever lived, and a Day whose length the Qur'an posts without apology: "The angels and the Spirit ascend to Him in a Day whose measure is fifty thousand years." The believer is given a private clause the Codex hangs beside that number: for him, the hadith says, it is lightened "until it is easier than an obligatory prayer he prayed in the world."

The sun is brought near "until it is a mile away" — and the narrator of Muslim preserves the deliberate ambiguity: mile of distance, or the mīl-rod of kohl; either way, said Sulaym ibn Amir, close. Mankind sweats by the ledger: to the ankles, to the knees, to the waist — "and some of them the sweat bridles to their mouths, by the measure of their deeds." Heat, crowd, exposure, and a duration with five digits: the tradition calls this simply al-Mawqif — the Standing.

In that furnace, shade is the Day's aristocracy — and its entry requirements were published centuries early. "Seven will Allah shade in His shade on the Day there is no shade but His: a just ruler; a youth who grew up in the worship of Allah; a man whose heart is attached to the mosques; two who loved each other for Allah's sake, meeting and parting on it; a man called by a woman of rank and beauty who said — I fear Allah; a man who gave charity and concealed it until his left hand did not know what his right spent; and a man who remembered Allah alone, and his eyes overflowed." Seven ordinary biographies, sorted under the Throne while empires queue in the sun. And an eighth clause for the traders: the merchant who gives time to the hard-pressed debtor, or waives the debt — "Allah will shade him in His shade."

The panic climbs until humanity remembers it once had advocates. The long intercession hadith — Bukhari and Muslim's masterpiece of narrative — walks the species from prophet to prophet: {{n:2|Adam}} (my sin — myself, myself), {{n:6|Nuh}}, {{n:9|Ibrahim}}, {{n:20|Musa}}, {{n:23|Isa}} — each transfers the file with the apology of the overwhelmed, until it stops at the door it was always addressed to: "I am for it. I am for it." {{n:60|The next node}} is that prostration.

The Codex fixes one architectural echo before the crowd moves: the believer has stood this standing before, in miniature, every year at {{n:44|Arafat}} — same plain-of-multitudes, same sun, same wuquf, same plea. The rite was the rehearsal; the Mawqif is the performance. Those who stood well once will recognize the choreography.`,
sequence:{phase:"Al-Qiyamah", position:"The Standing — al-Mawqif", note:"70:4 — a Day of fifty thousand years; lightened for the believer"},
timeline:[
 {label:"The plain fills", detail:"Every nation, every century"},
 {label:"Sun at a mile", detail:"Sweat by the measure of deeds — Muslim 2864"},
 {label:"The Seven shaded", detail:"Bukhari 660 · Muslim 1031"},
 {label:"The merchant's clause", detail:"Ease the debtor — Muslim 3006"},
 {label:"Prophet to prophet", detail:"Adam → Nuh → Ibrahim → Musa → Isa"},
 {label:"“I am for it”", detail:"The file reaches Muhammad ﷺ"}],
facts:[
 {label:"Duration",value:"50,000 years (70:4)"},
 {label:"For the believer",value:"Like one prayer"},
 {label:"Sun",value:"One mile — or a kohl-rod"},
 {label:"Sweat",value:"Ankles → bridle, by deeds"},
 {label:"Shade list",value:"7 + the easing merchant"},
 {label:"Rehearsal",value:"Arafat — every year"}],
quran:[
 {ref:"70:4",ar:"تَعْرُجُ الْمَلَائِكَةُ وَالرُّوحُ إِلَيْهِ فِي يَوْمٍ كَانَ مِقْدَارُهُ خَمْسِينَ أَلْفَ سَنَةٍ",en:"The angels and the Spirit ascend to Him in a Day whose measure is fifty thousand years."},
 {ref:"83:6",ar:"يَوْمَ يَقُومُ النَّاسُ لِرَبِّ الْعَالَمِينَ",en:"The Day mankind will stand before the Lord of the worlds."}],
hadith:[
 {text:"The sun is brought near on the Day of Resurrection until it is a mile away… and the people are in sweat by the measure of their deeds — some to the ankles, some to the knees, some to the waist, and some bridled by it.",source:"Muslim 2864"},
 {text:"Seven will Allah shade in His shade on the Day there is no shade but His…",source:"Bukhari 660 · Muslim 1031"},
 {text:"Whoever gives respite to one in difficulty, or relieves him — Allah will shade him in His shade on the Day there is no shade but His.",source:"Muslim 3006"}],
lessons:[
 "The Day's aristocracy is moral, and its entry list is already published — join a category tonight",
 "Fifty thousand years compress for the one whose five daily standings were sincere",
 "Arafat was the dress rehearsal: learn the plain before the plain"],
connections:[58,60,44]
}},

{id:60, replace:{
titleEn:"Ash-Shafa'a — Maqam Mahmud",
titleAr:"الشفاعة والمقام المحمود",
metric:"“I am for it”",
details:`The species has been refused by five prophets. Adam pleads his tree, Nuh his question, Ibrahim his three words of debate-craft, Musa his struck Egyptian, Isa mentions no sin at all and still says: myself, myself — go to Muhammad, "a servant whose past and future have been forgiven." So the file of mankind arrives at the door of the man who spent his nights weeping "my ummah, my ummah."

"I am for it," he ﷺ says twice in the narration — and goes, and falls in prostration beneath the Throne. He does not begin with the request. "Allah will open upon me of His praises and the beauty of extolment something He never opened for anyone before me" — new praise, coined for that prostration, the Qur'an's promised "praised station" being minted in real time. Then: "O Muhammad, raise your head. Ask — you will be given. Intercede — you will be granted." This is al-Maqam al-Mahmud of 17:79 — the station for which every adhan-answering du'a on earth has been a nomination ballot: "…and raise him to the praised station You promised him," and whoever says it, "my intercession becomes lawful for him."

The Great Intercession opens the Judgment itself — relief for all creation, believer and denier alike, from the unendurable Standing. But the ledger of his ﷺ advocacy runs longer, and the Codex posts its columns: intercession for the people of major sins of his ummah — "my intercession is for the people of the major sins of my nation"; for stalled believers on {{n:63|the Sirat}}; for the raising of ranks; for admission {{n:64|without account}} of seventy thousand — with each thousand, the narrations add, seventy thousand more; and for his uncle Abu Talib, lightened to the shallows of the Fire — the only exception, held in place by the honesty of the texts. Beside his station, the Day's other advocates take their posts by permission: the angels, the prophets, the martyrs, the memorizers' Qur'an itself — "Fasting and the Qur'an intercede for the servant" — and the children who died young, dragging their parents toward the Garden by the hand, refusing to enter alone.

Every intercession runs on one axle, and the Qur'an fixed it against every pagan fantasy of pull and patronage: "Who is it that can intercede with Him except by His permission?" No advocate storms the court. The permission is the mercy; the intercessor is its instrument; and the instrument's own summary of his role survives in Muslim: "I will be the first intercessor and the first whose intercession is accepted."

One du'a keys the reader into this node's machinery, thirty seconds after every adhan, five times a day. The Codex assumes you will use it tonight.`,
sequence:{phase:"Al-Qiyamah", position:"The Judgment opened", note:"17:79 — the Praised Station; the Great Intercession precedes the account"},
timeline:[
 {label:"Five refusals", detail:"Adam → Nuh → Ibrahim → Musa → Isa"},
 {label:"“I am for it”", detail:"Twice — Bukhari 7410"},
 {label:"Prostration beneath the Throne", detail:"New praises opened"},
 {label:"“Ask — you will be given”", detail:"Maqam Mahmud minted — 17:79"},
 {label:"Judgment relieved open", detail:"For all creation"},
 {label:"The long ledger", detail:"Major sinners · ranks · 70,000 × 70,000"}],
facts:[
 {label:"The station",value:"Maqam Mahmud — 17:79"},
 {label:"His summary",value:"First intercessor accepted"},
 {label:"For whom",value:"Major sinners of the ummah"},
 {label:"Without account",value:"70,000 — multiplied"},
 {label:"Other advocates",value:"Angels · prophets · Qur'an · children"},
 {label:"The axle",value:"“Except by His permission”"}],
quran:[
 {ref:"17:79",ar:"عَسَىٰ أَن يَبْعَثَكَ رَبُّكَ مَقَامًا مَّحْمُودًا",en:"It may be that your Lord will raise you to a praised station."},
 {ref:"2:255",ar:"مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ",en:"Who is it that can intercede with Him except by His permission?"}],
hadith:[
 {text:"The believers will go to Adam, then Nuh, then Ibrahim, then Musa, then Isa — and he will say: go to Muhammad… so they come to me, and I say: I am for it, I am for it.",source:"Bukhari 7410 · Muslim 194"},
 {text:"My intercession is for the people of the major sins of my ummah.",source:"Abu Dawud 4739 · Tirmidhi 2435 (sahih)"},
 {text:"Whoever says after the adhan: O Allah, Lord of this perfect call… and raise him to the praised station You promised him — my intercession becomes lawful for him on the Day of Resurrection.",source:"Bukhari 614"},
 {text:"I will be the first intercessor and the first whose intercession is accepted.",source:"Muslim 2278"}],
lessons:[
 "The Day's first relief arrives through the man who wept “my ummah” — love him accordingly",
 "Intercession is permission-based mercy, not courtroom patronage",
 "The adhan du'a is a daily appointment with this exact scene — keep it"],
connections:[59,61,6]
}},

// ——— NEW NODE 61: Al-Hawd ———
{id:61, insert:{
period:"nihaya",
titleEn:"Al-Hawd — The Basin of Kawthar",
titleAr:"الحوض المورود",
metric:"A month's journey wide",
summary:"Whiter than milk, sweeter than honey, vessels like the stars — one drink, and no thirst ever again.",
pattern:"pattern-nihaya",
details:`Somewhere in the geography of the Day stands a body of water with the most beloved specifications in the tradition — because he ﷺ described it personally, repeatedly, like a man describing a homecoming: "My Basin is a month's journey across. Its water is whiter than milk, its scent finer than musk, its drinking-vessels like the stars of the sky — and whoever drinks from it will never thirst again."

Its source is the Day's own plumbing of mercy: two spouts feed it from {{n:64|al-Kawthar}}, the river granted in the shortest surah of the Qur'an — revealed, with perfect timing, when Makkah was calling him ﷺ "cut off," childless, futureless: "Indeed, We have granted you al-Kawthar — the abundance." History's answer to that taunt is a basin the width of a month, serving a nation of every century, with the taunters absent.

He ﷺ stands at it in person: "I am your forerunner to the Basin" — farat, the rider sent ahead of the caravan to prepare the water. The reunion protocol is on record: "You will come to me with radiant faces and radiant limbs from the traces of wudu — a marking no other nation carries." The ummah is recognized at the water by its ablutions: fourteen centuries of bathroom sinks and cold mornings, suddenly legible as the Day's identification system.

And then the tradition's most sobering scene, which the Codex refuses to soften because the Sahihayn refused: men will be pulled away from the water before his eyes. "I will say: my companions, my companions! And it will be said: you do not know what they innovated after you. And I will say: away, away, with whoever changed after me." The Basin has a bouncer, and the bouncer's criterion is fidelity to the way — not names, claims, or proximity. No sentence in the eschatology file argues more precisely for leaving the religion as he ﷺ left it.

The scholars' map of the Day places the Basin twice, and the Codex notes the survey honestly: its great station is in the plain before {{n:63|the Sirat}} — mercy before the crossing — with reports of a second serving at the far side, by the gate. Either way, its function in the sequence is the same and is the reason this tile exists: between {{n:59|the sun at a mile}} and {{n:62|the opened ledgers}}, the Day of maximum thirst contains an announced, named, month-wide act of hospitality — hosted by the one man who spent the Day interceding, now pouring water for his guests.

One drink ends thirst forever. The Path's remaining nodes hold no scene gentler than this one until {{n:64|the Garden's own gates}}.`,
sequence:{phase:"Al-Qiyamah", position:"Before the crossing", note:"Fed by two spouts from al-Kawthar — Muslim 2300-2303"},
timeline:[
 {label:"Al-Kawthar granted", detail:"Surah 108 — the answer to “cut off”"},
 {label:"Two spouts fill the Basin", detail:"Muslim 2300"},
 {label:"He ﷺ arrives first", detail:"“I am your forerunner” — Bukhari 6575"},
 {label:"The ummah recognized", detail:"Radiance of wudu — Muslim 246"},
 {label:"Some pulled away", detail:"“You do not know what they changed” — Bukhari 6582"},
 {label:"One drink", detail:"Thirst ends — permanently"}],
facts:[
 {label:"Width",value:"A month's journey"},
 {label:"Water",value:"Whiter than milk"},
 {label:"Scent",value:"Finer than musk"},
 {label:"Vessels",value:"Like the stars in number"},
 {label:"ID system",value:"Traces of wudu"},
 {label:"Effect",value:"Never thirsty again"}],
quran:[
 {ref:"108:1-2",ar:"إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ فَصَلِّ لِرَبِّكَ وَانْحَرْ",en:"Indeed, We have granted you al-Kawthar — so pray to your Lord and sacrifice."}],
hadith:[
 {text:"My Basin is a month's journey. Its water is whiter than milk, its scent finer than musk, its vessels like the stars of the sky — whoever drinks from it will never thirst again.",source:"Bukhari 6579 · Muslim 2292"},
 {text:"I am your forerunner to the Basin — whoever passes by me will drink, and whoever drinks will never thirst.",source:"Bukhari 6575 · Muslim 2290"},
 {text:"Men from my companions will be brought toward me, then snatched away… I will say: my companions! It will be said: you do not know what they innovated after you.",source:"Bukhari 6582 · Muslim 2304"},
 {text:"You will come to me with radiant faces and limbs from the traces of wudu — a mark of no nation but mine.",source:"Muslim 246-247"}],
lessons:[
 "Every wudu is a future ID check — the sink is connected to the Basin",
 "Access is by fidelity, not familiarity: “whoever changed after me” is turned away",
 "The Day's harshest hour contains its most personal hospitality — hosted by him ﷺ"],
connections:[60,62,64]
}},

{id:62, replace:{
titleEn:"Hisab & Mizan — Ledgers and the Scale",
titleAr:"الحساب والميزان",
metric:"A card outweighs 99 scrolls",
details:`The books fly. "As for he who is given his record in his right hand — he will say: Here, read my record! I knew I would meet my account." And the other hand, and behind the back — postures of receipt already sorting eternity. "We place the scales of justice for the Day of Resurrection, and no soul is wronged at all — and if there is the weight of a mustard seed, We bring it. Sufficient are We as accountant."

The Codex posts the courtroom's published procedures, because this court publishes:

The private audience. The believer is brought near, and his Lord covers him with His screen and takes him through his sins one by one — do you recognize this? do you recognize this? — until, certain of ruin, he hears the reversal: "I concealed it for you in the world, and I forgive it for you today." Bukhari and Muslim both carry it. The believer's audit is designed as the gentlest conversation he will ever have about the worst things he ever did.

The fatal audit. "Whoever's account is examined is destroyed," he ﷺ said — and when Aisha cited "an easy account" (84:8), he answered: that is only the presentation. The pass condition of the Day is not a clean ledger; it is mercy declining to open the ledger line by line.

The order of cases. First matter judged among the people: blood. First deed weighed of the servant: the prayer — "if it is sound, he has succeeded; if it is corrupt, he has failed" — with the voluntary prayers patching the obligatory, by His own instruction to the angels. The bankrupt is redefined for eternity: the one who arrives with mountains of prayer and charity, and creditors of slander, blows, and seized wealth — paid off in good deeds until he is paying in their sins.

The Scale itself is real weight for real deeds, and its posted exchange rates are the tradition's standing mercy: "Two words, light on the tongue, heavy on the Scale, beloved to the Most Merciful: Subhan Allah wa bi-hamdih, Subhan Allah al-Azim." Good character, he ﷺ said, is the heaviest single deposit. And the bitaqa — the card: a man processed through ninety-nine scrolls of sin, each stretching as far as the eye reaches, then handed one card — ash-hadu an la ilaha illallah wa ash-hadu anna Muhammadan abduhu wa rasuluh — placed opposite them: "and the scrolls fly up, and the card outweighs. Nothing outweighs the name of Allah." (Tirmidhi, graded sahih.)

No soul is wronged a mustard seed; most souls are shown, on the record, how much of their salvation was never their arithmetic. {{n:63|The bridge}} is next, and the ranks of crossing are already computed from what the Scale just weighed.`,
sequence:{phase:"Al-Qiyamah", position:"The account & the weighing", note:"21:47 — scales of justice; mercy holds the audit's margin"},
timeline:[
 {label:"Records fly to hands", detail:"Right · left · behind the back — 69:19, 84:10"},
 {label:"The private audience", detail:"“I concealed it… I forgive it” — Bukhari 2441"},
 {label:"First cases", detail:"Blood among people · prayer of the servant"},
 {label:"The bankrupt paid out", detail:"Muslim 2581"},
 {label:"The Scale set", detail:"Mustard-seed precision — 21:47"},
 {label:"The card outweighs", detail:"99 scrolls vs. the shahada — Tirmidhi 2639"}],
facts:[
 {label:"Precision",value:"A mustard seed"},
 {label:"Believer's audit",value:"Screened & forgiven"},
 {label:"Examined in detail",value:"= destroyed (Bukhari 6536)"},
 {label:"First deed weighed",value:"The prayer"},
 {label:"Heaviest deposit",value:"Good character"},
 {label:"The card",value:"Outweighs 99 scrolls"}],
quran:[
 {ref:"21:47",ar:"وَنَضَعُ الْمَوَازِينَ الْقِسْطَ لِيَوْمِ الْقِيَامَةِ فَلَا تُظْلَمُ نَفْسٌ شَيْئًا",en:"We place the scales of justice for the Day of Resurrection, and no soul is wronged at all."},
 {ref:"101:6-8",ar:"فَأَمَّا مَن ثَقُلَتْ مَوَازِينُهُ فَهُوَ فِي عِيشَةٍ رَّاضِيَةٍ وَأَمَّا مَنْ خَفَّتْ مَوَازِينُهُ",en:"As for him whose scales are heavy — a pleasing life; and as for him whose scales are light…"}],
hadith:[
 {text:"Allah brings the believer near and covers him with His screen: Do you recognize this sin?… I concealed it for you in the world, and I forgive it for you today.",source:"Bukhari 2441 · Muslim 2768"},
 {text:"Whoever's account is examined is destroyed. Aisha said: Does Allah not say “an easy account”? He said: That is the presentation.",source:"Bukhari 6536 · Muslim 2876"},
 {text:"Two words, light on the tongue, heavy on the Scale, beloved to the Most Merciful: Subhan Allah wa bi-hamdih, Subhan Allah al-Azim.",source:"Bukhari 7563 · Muslim 2694"},
 {text:"The scrolls fly up and the card outweighs — nothing outweighs the name of Allah.",source:"Tirmidhi 2639 (sahih)"}],
lessons:[
 "Aim for the screened audit, not the clean ledger — mercy is the pass condition",
 "Keep the prayer sound: it is the first line item of your entire existence",
 "Say the two light-heavy words today — the Scale is already listed on them"],
connections:[61,63,60]
}},

{id:63, replace:{
titleEn:"As-Sirat — The Bridge over the Fire",
titleAr:"الصراط",
metric:"Sharper than a sword",
summary:"Thinner than a hair, sharper than a sword — crossed at the speed of your deeds.",
details:`"There is none of you but will arrive at it — a matter decreed upon your Lord, inevitable." The verse stunned the companions until the next verse exhaled: "Then We will save those who feared Him, and leave the wrongdoers therein on their knees." The arrival is universal; the crossing is not.

The bridge is laid across the back of Jahannam — "and I and my ummah," he ﷺ said, "will be the first to cross." The engineering specifications, from Sahih Muslim: "slippery, seizing; on it hooks like the thorns of as-Sa'dan" — a desert thorn every Arab listener knew by the scar — "except that none knows their size but Allah; they snatch the people by their deeds." Abu Sa'id added the description the Codex sets in this tile's metric: "It has reached me that the bridge is thinner than a hair and sharper than a sword."

Traffic moves by a physics the world never sold: velocity as a function of deeds. "The believer crosses like the blink of an eye, like lightning, like wind, like birds, like the finest horses and riders — one delivered safe, one scratched and released, one shoved down into the Fire." Under a bridge lit by nothing, each crosser is issued his own illumination — "their light running before them and on their right" — and the hypocrites, who borrowed light in the world, watch it switched off mid-span: "Wait for us that we may borrow from your light. It will be said: go back and seek light." A wall is struck between — mercy on its inner face, punishment on its outer.

On the span, the only sound the tradition reports from its greatest voices is a two-word du'a. The prophets themselves — the same men who split seas and cooled fires — stand at the bridge saying: "Allahumma sallim, sallim" — O Allah, bring them through, bring them through. Whoever wants to know what the Day does to confidence: it reduces the messengers to two words, repeated.

And the file the Sahihayn append to the crossing, which the Codex refuses to trim: the Qantara. After the bridge, the saved are halted on an arch before {{n:64|the Garden}} — and retribution is settled between them for the injustices that remained among believers, "until, when they are refined and purified, they are given leave to enter." The Garden's door policy: no unresolved wrong walks through. Forgive your brother tonight, the tile suggests, or the arch will hold the meeting later.

The last man across is the tradition's most tender comedy: dragged, scorched, crawling — and then bargaining with his Lord tree by tree, oath after broken oath, until he is asked what would satisfy him and laughed toward more than he dreamed. He is the floor of {{n:64|the next node}}: the least citizen of a kingdom {{n:64|ten times this world}}.`,
sequence:{phase:"Al-Qiyamah", position:"The crossing", note:"19:71-72 — universal arrival, selective salvation; Qantara after the span"},
timeline:[
 {label:"All arrive at it", detail:"19:71 — “a matter decreed”"},
 {label:"He ﷺ and the ummah first", detail:"Bukhari 806 · Muslim 182"},
 {label:"Hooks like Sa'dan thorns", detail:"Snatching by deeds — Muslim 183"},
 {label:"Speeds by deeds", detail:"Lightning → wind → birds → crawling"},
 {label:"“Sallim, sallim”", detail:"The prophets' entire vocabulary"},
 {label:"The Qantara", detail:"Believers' mutual claims settled — Bukhari 6535"},
 {label:"The last man", detail:"Bargains tree by tree — Muslim 187"}],
protection:[
 "Light on the bridge is earned now: “their light runs before them” — 57:12; wudu, salah, and Qur'an are its fuel",
 "Settle wrongs before the Qantara settles them: forgive and seek forgiveness tonight",
 "Constancy over heroics: the crossing speeds were set by ordinary daily deeds"],
facts:[
 {label:"Span",value:"Over Jahannam's back"},
 {label:"Fineness",value:"Thinner than a hair"},
 {label:"Edge",value:"Sharper than a sword"},
 {label:"Hooks",value:"Sa'dan thorns — sized by Allah"},
 {label:"Speeds",value:"Blink → lightning → crawl"},
 {label:"After it",value:"The Qantara — claims settled"}],
quran:[
 {ref:"19:71-72",ar:"وَإِن مِّنكُمْ إِلَّا وَارِدُهَا ۚ كَانَ عَلَىٰ رَبِّكَ حَتْمًا مَّقْضِيًّا ثُمَّ نُنَجِّي الَّذِينَ اتَّقَوا",en:"There is none of you but will arrive at it — a matter decreed. Then We save those who feared Him…"},
 {ref:"57:12",ar:"يَوْمَ تَرَى الْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ يَسْعَىٰ نُورُهُم بَيْنَ أَيْدِيهِمْ",en:"The Day you see the believing men and women, their light running before them…"}],
hadith:[
 {text:"The bridge is laid across Jahannam, and I and my ummah are the first to cross; and none speaks that day but the messengers — and the du'a of the messengers: O Allah, bring through, bring through.",source:"Bukhari 806 · Muslim 182"},
 {text:"On it are hooks like the thorns of Sa'dan — none knows their size but Allah — snatching the people by their deeds.",source:"Muslim 183"},
 {text:"It has reached me that the bridge is thinner than a hair and sharper than a sword.",source:"Muslim 183 (Abu Sa'id)"},
 {text:"When the believers cross, they are halted on a qantara between Jannah and the Fire, and retribution is settled between them — until, refined, they are given leave to enter.",source:"Bukhari 6535"}],
lessons:[
 "Your crossing speed is being set today, in traffic, at work, before dawn",
 "Even prophets go monosyllabic at the Fire — take seriously what silences them",
 "No grudge enters the Garden: the Qantara is the last customs check"],
connections:[62,64,61]
}},

{id:64, replace:{
titleEn:"Jannah — What No Eye Has Seen",
titleAr:"الجنة",
metric:"The Vision — 75:22-23",
details:`The Codex ends where every sound heart was always pointed. "And those who feared their Lord will be driven to the Garden in companies — until, when they reach it, its gates are opened, and its keepers say: Peace be upon you; you have become pure; so enter it, abiding eternally." Eight gates — among them one the fasting alone may use: "In Jannah is a gate called ar-Rayyan; those who fasted enter through it, and when they have entered, it is closed." At the gates, on the record of the Sahihayn: "I will come to the gate of Jannah on the Day of Resurrection and ask for it to be opened. The keeper will say: Who are you? I will say: Muhammad. He will say: For you I was commanded — I open for no one before you."

What is inside was placed, by design, beyond the reach of preview: "I have prepared for My righteous servants what no eye has seen, no ear has heard, and no human heart has ever conceived." The Qur'an's descriptions — rivers of water, milk, honey, and wine that does not wound; gardens beneath which rivers flow; couches, brocade, pearls, pavilions — are, the scholars say, names borrowed from the world for realities that outgrow the names. The dimensions leak scale: a width like the heavens and the earth; a hundred levels between each of which is the distance of sky to earth — "so when you ask Allah, ask Him for al-Firdaws, for it is the middle of Jannah and the highest of it, and above it is the Throne of the Most Merciful, and from it the rivers spring." A tree in whose shade a rider travels a hundred years without crossing it. A market kept for every Jumu'ah, where a wind from the north lifts beauty onto the faces of a people already beautiful. The lowest citizen — {{n:63|the last man dragged across}} — receives ten times this entire world, and is made to feel he has been favored.

The residents arrive re-made: upon the form of their father {{n:2|Adam}}, sixty cubits, thirty-three years old, hearts like one heart — rancor extracted by decree, the disease of {{n:4|the first murder}} surgically removed at the door: "We remove whatever is in their breasts of resentment — brothers, on couches, facing one another." Families are reunited across the ranks — "We join their descendants to them, and We deprive them of nothing of their deeds" — and {{c:a-ridwan|the keepers}} enter upon them from every gate: "Peace upon you for what you patiently endured — how excellent is the final home."

Then the tradition's two closing ceremonies, than which nothing higher exists. Death itself is brought "in the form of a fine ram" and slaughtered between the Garden and the Fire: "O people of Jannah — eternity, no death; O people of the Fire — eternity, no death." And the address from above: "Allah will say to the people of Jannah: O people of Jannah! They will say: At Your service, our Lord. He will say: Are you pleased? They will say: How could we not be pleased when You have given us what You gave no one of Your creation? He will say: Shall I not give you better than that? They will say: What could be better? He will say: I bestow upon you My pleasure — and I will never be angry with you after it, forever."

And above even the pleasure, the sight the whole Path has been walking toward, promised in the Qur'an's calmest sentence and confirmed in the Sahihayn's brightest hadith: "Faces that Day radiant — looking at their Lord." — "You will see your Lord as you see the full moon, without crowding." What {{n:20|Musa was denied at the mountain}} is granted to the least believer at home. The ziyada — "for those who do good: the best, and more" — is, he ﷺ said, that the veil is lifted; "and they are given nothing more beloved to them than the look at His Face."

From the Throne over the water at {{n:1|the first node}} to the Throne above Firdaws at the last, from كن at the opening to سلام at the gates — the Codex closes its own circle here, and leaves the reader one working instruction, his ﷺ own: when you ask, ask for Firdaws.`,
sequence:{phase:"The Final Home", position:"The Path's destination", note:"Eight gates · 100 levels · Firdaws beneath the Throne"},
timeline:[
 {label:"Driven in companies", detail:"Gates opened — “Peace be upon you” (39:73)"},
 {label:"He ﷺ opens the first gate", detail:"“For you I was commanded” — Muslim 197"},
 {label:"Ar-Rayyan admits the fasting", detail:"Bukhari 1896 · Muslim 1152"},
 {label:"Rancor removed at entry", detail:"15:47 — hearts like one heart"},
 {label:"Death slaughtered", detail:"“Eternity — no death” — Bukhari 6548"},
 {label:"The Pleasure bestowed", detail:"“Never angry after it, forever” — Bukhari 6549"},
 {label:"The Vision", detail:"“As you see the full moon” — Bukhari 554"}],
facts:[
 {label:"Gates",value:"8 — incl. ar-Rayyan"},
 {label:"Levels",value:"100 — Firdaws highest"},
 {label:"Width",value:"As heavens + earth"},
 {label:"Residents' form",value:"Adam's — 60 cubits, age 33"},
 {label:"Lowest rank",value:"10 × this world"},
 {label:"Market",value:"Every Jumu'ah"},
 {label:"Greatest gift",value:"His pleasure — then His Face"}],
quran:[
 {ref:"75:22-23",ar:"وُجُوهٌ يَوْمَئِذٍ نَّاضِرَةٌ إِلَىٰ رَبِّهَا نَاظِرَةٌ",en:"Faces that Day will be radiant — looking at their Lord."},
 {ref:"32:17",ar:"فَلَا تَعْلَمُ نَفْسٌ مَّا أُخْفِيَ لَهُم مِّن قُرَّةِ أَعْيُنٍ جَزَاءً بِمَا كَانُوا يَعْمَلُونَ",en:"No soul knows what delight of the eyes is hidden for them — a reward for what they used to do."},
 {ref:"13:23-24",ar:"وَالْمَلَائِكَةُ يَدْخُلُونَ عَلَيْهِم مِّن كُلِّ بَابٍ سَلَامٌ عَلَيْكُم بِمَا صَبَرْتُمْ فَنِعْمَ عُقْبَى الدَّارِ",en:"…and the angels enter upon them from every gate: Peace upon you for what you patiently endured — how excellent is the final home."}],
hadith:[
 {text:"I have prepared for My righteous servants what no eye has seen, no ear has heard, and no human heart has conceived.",source:"Bukhari 3244 · Muslim 2824"},
 {text:"When you ask Allah, ask Him for al-Firdaws — it is the middle of Jannah and its highest, above it is the Throne of the Most Merciful, and from it spring the rivers of Jannah.",source:"Bukhari 2790"},
 {text:"Death is brought as a fine ram and slaughtered between Jannah and the Fire: O people of Jannah — eternity, no death.",source:"Bukhari 6548 · Muslim 2849"},
 {text:"I bestow upon you My pleasure, and I will never be angry with you after it, forever.",source:"Bukhari 6549 · Muslim 2829"},
 {text:"You will see your Lord as you see this full moon — you will not be wronged in seeing Him.",source:"Bukhari 554 · Muslim 633"}],
lessons:[
 "Ask specifically: Firdaws, beneath the Throne — he ﷺ told you the address",
 "The Garden's peak is not a place but a Face — train the heart on 75:22-23 now",
 "Rancor is removed at the door; whoever empties his heart early lives the Garden early",
 "From Kun to Salam: the whole Path was one sentence of mercy completing itself"],
connections:[63,61,1,2]
}}

];
