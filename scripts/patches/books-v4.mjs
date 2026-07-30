// NOOR v4: opens Books 3 (Al-Jahiliyyah), 5 (Al-Khulafa), 6 (Al-Umam) as real Path chapters.
// Authored in FINAL 71-id space. The builder applies the 64→71 shift to older content first.
// periodMoves reassigns existing chapters into the jahiliyyah period. No em dashes.
export default {

periodMoves: { 24: "jahiliyyah", 26: "jahiliyyah" },

nodes: [

// ——— 25 · The Hunafa (Book 3) ———
{id:25, insert:{
period:"jahiliyyah",
titleEn:"The Hunafa: Seekers before the Light",
titleAr:"الحنفاء",
metric:"A nation of one man",
summary:"In a world of idols, a scattered few refused: the seekers of Ibrahim's way, waiting for a prophet they would barely meet.",
pattern:"pattern-2",
details:`Even at {{n:24|Jahiliyya's}} darkest, the fitrah did not go extinct. The Prophet ﷺ taught the baseline: "every newborn is born upon the fitrah" (Bukhari 1358), the factory-setting of tawhid; and scattered across Arabia a few souls refused to let their setting be overwritten. The tradition calls them the hunafa, after the word the Qur'an uses for Ibrahim: hanif, inclined away from every false object of worship toward the One.

The best documented is Zayd ibn Amr ibn Nufayl, uncle of {{c:c-umar|Umar}} and father of {{c:c-said-zayd|Sa'id}}. Bukhari preserves his file like a case study: he met the young Muhammad ﷺ before revelation and refused meat slaughtered for idols; he told Quraysh to their faces that the sheep Allah created, watered by Allah's rain, deserved better than their stones; he traveled to Sham questioning rabbis and monks until a scholar told him the religion he sought, the hanifiyyah of Ibrahim, had no living community, but a prophet was about to rise in his own land. He came home saying: "O Allah, bear witness that I am upon the religion of Ibrahim." He rescued infant daughters from live burial, raising them and returning them grown to fathers who had wanted them dead. He died before {{n:30|Iqra}}, and the Prophet ﷺ said he will be raised on the Day of Rising "a nation by himself."

{{c:c-waraqah|Waraqah ibn Nawfal}} took the book-road instead: Christian scripture, until age took his eyes, and the first revelation was carried to his lap for identification. {{c:c-salman|Salman}} walked the longest road of all, out of Persia's fire-temples through a chain of dying monks, each pointing forward. Different roads, one refusal, and one direction of waiting.

The Codex gives the hunafa their own chapter for a precise doctrinal reason: they prove that the darkness was a choice. No revelation had reached that generation, yet the fitrah plus honest reasoning was enough to reject the stones, honor the daughters, and point a man's face toward the Lord of Ibrahim. Heaven does not ignore such pointing: one seeker got the answer at {{p:p-hira|Hira}} within his own city, one identified it in his old age, and one crossed an empire to kneel in {{p:p-madinah|its city}}. The age of ignorance was never an excuse; it was a test with a passing grade on record.`,
facts:[
 {label:"Word",value:"Hanif: inclined to the One"},
 {label:"Baseline",value:"Fitrah (Bukhari 1358)"},
 {label:"Zayd ibn Amr",value:"“A nation by himself”"},
 {label:"His rescue work",value:"Buried daughters, saved"},
 {label:"Other roads",value:"Waraqah's books · Salman's journey"},
 {label:"Verdict",value:"Darkness was a choice"}],
quran:[
 {ref:"30:30",ar:"فَأَقِمْ وَجْهَكَ لِلدِّينِ حَنِيفًا ۚ فِطْرَتَ اللَّهِ الَّتِي فَطَرَ النَّاسَ عَلَيْهَا",en:"So set your face toward the religion as a hanif: the fitrah of Allah upon which He created mankind."},
 {ref:"16:120",ar:"إِنَّ إِبْرَاهِيمَ كَانَ أُمَّةً قَانِتًا لِّلَّهِ حَنِيفًا وَلَمْ يَكُ مِنَ الْمُشْرِكِينَ",en:"Indeed Ibrahim was a nation, devoutly obedient to Allah, a hanif, and he was not of the polytheists."}],
hadith:[
 {text:"Every newborn is born upon the fitrah; then his parents make him a Jew, a Christian, or a Magian.",source:"Bukhari 1358 · Muslim 2658"},
 {text:"Zayd ibn Amr used to say: O Quraysh, by Allah none of you is upon the religion of Ibrahim but me. And he would revive the buried girls, saying to a father: I will suffice you her provision.",source:"Bukhari 3828"}],
lessons:[
 "The fitrah is standard equipment: no era, however dark, cancels it",
 "Honest reasoning reached tawhid before revelation arrived to confirm it",
 "Whoever turns his face toward the truth, the truth is already traveling toward him"],
connections:[24,26,30]
}},

// ——— 47 · Abu Bakr's Caliphate (Book 5) ———
{id:47, insert:{
period:"khulafa",
titleEn:"Abu Bakr: The Ummah Holds",
titleAr:"خلافة أبي بكر",
metric:"2 years that saved the rest",
summary:"Two years and three months in which the community survived its Prophet's ﷺ death, its apostasy storm, and the loss of its reciters.",
pattern:"pattern-khulafa",
details:`The morning after {{n:46|the hardest morning}}, the community faced the question no one had faced before: what is a Muslim polity without its Prophet? At the courtyard of Banu Sa'idah the Ansar and Muhajirun resolved it in one difficult afternoon: {{c:c-umar|Umar}} took {{c:c-abubakr|Abu Bakr's}} hand, the pledge followed, and the man who had been the second of two in {{p:p-thawr|the cave}} stood on the minbar with the inaugural speech that still defines Islamic office: "I have been given authority over you, and I am not the best of you. If I do well, help me; if I do wrong, set me right... Obey me so long as I obey Allah and His Messenger; if I disobey them, you owe me no obedience."

His first act was deliberately unspectacular: he dispatched {{c:c-usama|Usama's}} army exactly as the Prophet ﷺ had tied its banner, walking beside the eighteen-year-old commander's mount, refusing to let grief cancel an order. His second act saved the religion's spine. Arabia convulsed: tribes apostatized, false prophets rose (Musaylimah the worst of them), and others accepted prayer but refused zakat. Counselors urged flexibility. The gentlest man of the generation answered with granite: "By Allah, I will fight whoever separates the prayer from the zakat, for zakat is the right due upon wealth. By Allah, if they withhold from me a young she-goat they used to render to the Messenger of Allah, I will fight them for withholding it." Umar later said: I saw that Allah had opened Abu Bakr's chest to the truth, and I knew it was right.

The riddah campaigns, {{c:c-khalid|Khalid}} foremost in the field, ended at Yamamah, where Musaylimah fell to {{c:c-wahshi|the same javelin}} that had killed Hamza, and where so many Qur'an reciters died that Umar feared the Book itself would fragment. From that fear came the caliphate's quietest, largest deed: {{c:c-zaydthabit|Zayd ibn Thabit}} commissioned to gather the Qur'an into one verified collection, the sheets that would one day sit in {{c:c-hafsah|Hafsah's}} room and become every mushaf on earth.

He ruled twenty-seven months, drew a small stipend he returned at death, and asked to be buried beside the one he had followed all his life. The Codex marks his chapter as the hinge that held: prophethood ended and the religion did not wobble, because the first successor treated authority as debt, not inheritance.`,
facts:[
 {label:"Reign",value:"11-13 AH · 27 months"},
 {label:"Inaugural rule",value:"“Obey me while I obey”"},
 {label:"First act",value:"Usama's army, unchanged"},
 {label:"The storm",value:"Riddah + false prophets"},
 {label:"The line held",value:"Prayer and zakat inseparable"},
 {label:"Quietest deed",value:"The Qur'an gathered"}],
quran:[
 {ref:"3:144",ar:"وَمَا مُحَمَّدٌ إِلَّا رَسُولٌ قَدْ خَلَتْ مِن قَبْلِهِ الرُّسُلُ",en:"Muhammad is only a messenger; messengers have passed away before him."}],
hadith:[
 {text:"By Allah, I will fight whoever separates the prayer from the zakat... if they withhold a young she-goat they used to render to the Messenger of Allah, I will fight them for it.",source:"Bukhari 7284 · Muslim 20"},
 {text:"Umar said: By Allah, it was nothing but that I saw Allah had opened Abu Bakr's chest to fighting them, and I knew it was the truth.",source:"Bukhari 7284"}],
lessons:[
 "Authority in Islam is a debt audited by the governed: “you owe me no obedience” if it strays",
 "Mercy in the man, granite in the mandate: obligations are not negotiable griefs",
 "The largest services are often archival: a gathered Book outlived every battle"],
connections:[46,48,34]
}},

// ——— 48 · Umar's Caliphate ———
{id:48, insert:{
period:"khulafa",
titleEn:"Umar: Justice Opens the Lands",
titleAr:"خلافة عمر",
metric:"10 years · half the old world",
summary:"A decade in which Persia fell, al-Quds opened to a caliph on foot, and a superpower's citizens met a ruler who slept under a tree.",
pattern:"pattern-khulafa",
details:`{{c:c-abubakr|Abu Bakr}} named his successor after consultation, and for ten years the world adjusted to a new phenomenon: power that feared Allah more than rivals. Under {{c:c-umar|Umar}} the two empires that had split the earth cracked in the same decade: Yarmuk broke Byzantine Syria, al-Qadisiyyah under {{c:c-saad|Sa'd ibn Abi Waqqas}} broke Sassanid Persia, and {{c:c-amr|Amr}} opened {{p:p-egypt|Egypt}}. When {{p:p-jerusalem|al-Quds}} asked for the caliph in person, he came sharing one mount with his servant, taking his turn on foot, and received the city without a sack, cleaning {{p:p-aqsa|the neglected rock}} with his own garment.

The inner architecture mattered more than the map. He founded the diwan registers and stipends, appointed and audited governors ruthlessly ("I did not send you to strike people's backs"), instituted the congregational tarawih behind {{c:c-ubayy|Ubayy}}, fixed {{n:34|the Hijrah}} as year one of the calendar, and patrolled Madinah at night, carrying a flour sack on his own back to a widow's fire because "who will carry my burden on the Day of Rising?" In the famine of the Year of Ash he ate oil till his stomach rumbled, and told it: rumble or not, you will taste nothing better till the people eat.

His fear was the ledger: "If a mule stumbled in Iraq, I would fear that Allah ask me: why did you not level the road for it, O Umar?" His du'a was on record in the Sahih: martyrdom in Allah's path, and death in the city of His Messenger ﷺ, a combination geography seemed to forbid. Both were granted at once: Fajr in his own mihrab, a Magian slave's poisoned blade, and a burial he begged from {{c:c-aisha|Aisha}} beside his two companions. Even bleeding, he ran the state: appointing the shura of six, capping his son out of it, and asking only whether his debts were paid.

The Prophet ﷺ had said shaytan takes another road when Umar walks; the Codex adds the historians' verdict: so did Caesar and Kisra. His chapter stands for the proof that justice is not power's ornament but its engine.`,
facts:[
 {label:"Reign",value:"13-23 AH · 10 years"},
 {label:"Fell in his decade",value:"Persia · Syria · Egypt · al-Quds"},
 {label:"Al-Quds entry",value:"On foot, sharing one mount"},
 {label:"Systems",value:"Diwan · calendar · tarawih"},
 {label:"His fear",value:"A mule's stumble in Iraq"},
 {label:"Du'a granted",value:"Shahadah + Madinah, together"}],
quran:[
 {ref:"24:55",ar:"وَعَدَ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَعَمِلُوا الصَّالِحَاتِ لَيَسْتَخْلِفَنَّهُمْ فِي الْأَرْضِ",en:"Allah has promised those who believe among you and do righteous deeds that He will grant them succession upon the earth."}],
hadith:[
 {text:"Umar said: O Allah, grant me martyrdom in Your path, and make my death in the city of Your Messenger ﷺ.",source:"Bukhari 1890"},
 {text:"He asked Aisha for burial beside his two companions, saying: if she refuses, carry me to the graveyard of the Muslims.",source:"Bukhari 1392"}],
lessons:[
 "Justice is logistics: registers, roads, audits, and a caliph's own shoulders",
 "Ask boldly for impossible combinations: heaven granted both halves in one dawn",
 "The ruler's nightmare is the Day's questioning, or he is not ruling for Allah"],
connections:[47,49,20]
}},

// ——— 49 · Uthman's Caliphate ———
{id:49, insert:{
period:"khulafa",
titleEn:"Uthman: One Book for the Ummah",
titleAr:"خلافة عثمان",
metric:"12 years · one mushaf",
summary:"The navy, the expansions, and the single written Qur'an; then the first fitnah, met with a neck offered rather than Muslim blood spilled.",
pattern:"pattern-khulafa",
details:`The shura of six weighed for three days and settled on {{c:c-uthman|Dhun-Nurayn}}. His twelve years split into the tradition's two halves: the decade of ease, in which the openings ran on through Africa's coast and Cyprus fell to Islam's first navy, stipends rose, {{p:p-madinah-masjid|the Prophet's mosque}} was expanded in stone; and the final years, in which the age of trials the Prophet ﷺ had foretold arrived on schedule.

His chapter's crown is on every shelf on earth. As the conquests scattered reciters across new garrisons, recitation disputes spread; Hudhayfah returned from the frontier begging: save this ummah before it differs over its Book like those before it. Uthman borrowed {{c:c-hafsah|Hafsah's}} sheets, set {{c:c-zaydthabit|Zayd's}} committee to copy them into a single exemplar with agreed spelling, sent a mushaf to each metropolis, and unified the written text of revelation forever (Bukhari 4987). Whoever opens any printed Qur'an today is reading the direct descendant of that decision.

Then the whispering campaign: grievances real and invented, letters forged in his name, and finally armed men from the garrisons around his house in Madinah. What follows is the sunnah's portrait of restraint under siege. He had the Prophet's own promise, "glad tidings of Jannah, with a calamity that will befall you" (Bukhari 3674), and he chose the reading of it that cost him everything: no civil war over his person. He turned away {{c:c-ali|Ali's}} sons and the companions' swords from his door, reminded the besiegers from his roof that he had equipped {{n:44|the hardship army}} and bought Rumah's well for them, and was killed at his recitation, an old man of eighty-two, his blood running onto the Book he had unified. The fitnah the Prophet foretold had begun; the Codex records its first casualty as the man who refused to let it begin with him.`,
facts:[
 {label:"Reign",value:"23-35 AH · 12 years"},
 {label:"Firsts",value:"Islam's navy · Cyprus"},
 {label:"The crown",value:"One written mushaf (Bukhari 4987)"},
 {label:"Under siege",value:"Forbade swords for his sake"},
 {label:"Promise held",value:"“Jannah, with a calamity”"},
 {label:"End",value:"Killed at his recitation, 82"}],
quran:[
 {ref:"15:9",ar:"إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ",en:"Indeed, We sent down the Reminder, and indeed We are its Guardian."}],
hadith:[
 {text:"Hudhayfah said: O Commander of the Believers, save this ummah before it differs over the Book as the Jews and Christians differed. So he sent to Hafsah for the sheets.",source:"Bukhari 4987"},
 {text:"Be at ease, Uthman: glad tidings of Jannah, with a calamity that will befall you.",source:"Bukhari 3674"}],
lessons:[
 "Guarding the text is guarding the ummah: his least dramatic act was his greatest",
 "There are victories that consist of refusing to fight: he priced Muslim blood above his own life",
 "Foretold trials still test real hearts; knowing the script does not exempt you from acting it well"],
connections:[48,50,46]
}},

// ——— 50 · Ali's Caliphate ———
{id:50, insert:{
period:"khulafa",
titleEn:"Ali: Wisdom in the Storm",
titleAr:"خلافة علي",
metric:"5 years holding the center",
summary:"The gate of knowledge governing through the ummah's bitterest years, judging brothers at war by the Book, and falling at Fajr in Ramadan.",
pattern:"pattern-khulafa",
details:`{{c:c-ali|Ali}} accepted the pledge over a city still bloody from {{n:49|Uthman's}} murder, and spent five years proving that the hardest arena of knowledge is not the lecture but the storm. The Qur'an had legislated for exactly his years in advance: "if two parties of the believers fight, make peace between them" (49:9), and its next verse kept both camps inside the faith: "the believers are but brothers." Ahl al-Sunnah read the era through those verses, and through the Prophet's ﷺ words about the players: {{c:c-ammar|Ammar}}, "killed by the transgressing party"; {{c:c-hasan|al-Hasan}}, the sayyid through whom Allah would reconcile two great parties; and the Khawarij, foretold with an archer's precision, "they pass through the religion as the arrow passes through the prey" (Bukhari 6930), reciting a Qur'an that does not pass their throats.

The Camel ended with Ali escorting {{c:c-aisha|the Mother of the Believers}} home with full honor, her regret and his reverence both on the record. Siffin bled into arbitration; the arbitration bred the Khawarij, who declared every sinner an infidel and made takfir a weapon; at Nahrawan he broke them, and he taught the ummah forever how to classify such people: do not call them disbelievers, he said, from disbelief they fled; they are brothers who transgressed against us. His capital in Kufa ran on a judge's temperament: the caliph appearing before his own qadi against a Jewish defendant over a coat of mail, and losing the case for lack of evidence, and the defendant embracing Islam at the sight.

In Ramadan of 40 AH, the Khariji Ibn Muljam struck him with a poisoned blade at Fajr. His last commands banned mutilation and collective revenge: a life for a life, nothing more. The Codex closes the four with the adab the ummah's imams fixed: love them all, ask mercy for all who fought, and hold the tongue where the swords once were, "that is a nation that has passed; theirs is what they earned" (2:134). What remains for us is what Ali carried through the storm: that knowledge, justice, and restraint are one discipline, and it is hardest, and most needed, when believers are the ones at odds.`,
facts:[
 {label:"Reign",value:"35-40 AH · Kufa"},
 {label:"Governing verses",value:"49:9-10, revealed ready"},
 {label:"On the Khawarij",value:"“Brothers who transgressed”"},
 {label:"In court",value:"Lost to a Jewish defendant, rightly"},
 {label:"End",value:"Fajr, Ramadan 40 AH"},
 {label:"Our adab",value:"Love all · withhold the tongue"}],
quran:[
 {ref:"49:9-10",ar:"وَإِن طَائِفَتَانِ مِنَ الْمُؤْمِنِينَ اقْتَتَلُوا فَأَصْلِحُوا بَيْنَهُمَا ۖ إِنَّمَا الْمُؤْمِنُونَ إِخْوَةٌ",en:"If two parties of the believers fight, make peace between them... the believers are but brothers."}],
hadith:[
 {text:"There will emerge a people who recite the Qur'an and it does not pass their throats; they pass through the religion as the arrow passes through the prey.",source:"Bukhari 6930 · Muslim 1066"},
 {text:"Ali said of the Khawarij: they are not disbelievers; from disbelief they fled. They are brothers who transgressed against us.",source:"Classical: Abd ar-Razzaq · al-Bayhaqi"}],
lessons:[
 "The Qur'an pre-wrote the rules for believers at war: both sides remain brothers",
 "Takfir is the arrow that exits the religion while aiming at it",
 "A caliph who can lose in court has already won the argument for Islam"],
connections:[49,51,46]
}},

// ——— 51 · The Preservation (Book 6) ———
{id:51, insert:{
period:"umam",
titleEn:"The Preservation: Book, Sunnah, Chain",
titleAr:"حفظ الدين",
metric:"15:9, engineered",
summary:"How one generation's memory became fourteen centuries of verified text: the mushaf, the isnad, and the sciences built as fortresses.",
pattern:"pattern-umam",
details:`Allah made this ummah a promise no earlier nation received: "Indeed, We sent down the Reminder, and indeed We are its Guardian" (15:9). This chapter documents the machinery the promise used. The Book first: gathered under {{n:47|Abu Bakr}}, unified under {{n:49|Uthman}}, and in parallel, always, carried in chests: an unbroken relay of memorizers from the Companions' circles to the millions of huffaz alive now, so that text and memory audit each other every taraweeh of every Ramadan.

The Sunnah demanded a second invention: the isnad. "This knowledge is religion," the early masters said, "so look from whom you take your religion"; and Ibn al-Mubarak's line became the science's motto: the isnad is part of the religion; were it not for the isnad, whoever wished would say whatever he wished. Chains of named, dated, biographied transmitters; a critical literature grading every carrier's memory and honesty; and then the great sievings: {{c:c-abuhurayrah|the Companions' narrations}} passing through {{c:c-aisha|Aisha's}} corrections, the circles of {{c:c-ibnabbas|Ibn Abbas}} and {{c:c-ibnmasud|Ibn Mas'ud}} founding the regional schools, until al-Bukhari sifts six hundred thousand reports for sixteen years, prays two rak'ahs before admitting each of the ~7,000 he accepts, and Muslim builds his Sahih beside it. No civilization ever built a stricter customs office for its own memory.

Around the two revelations rose the guard-sciences: Arabic grammar codified so the Book's tongue could not drift; usul al-fiqh so law could be derived, not improvised; the four imams, Abu Hanifah, Malik, ash-Shafi'i, and Ahmad, building the madhhabs as disciplined highways to the same qiblah, each saying in his own words: if the hadith is authentic, that is my madhhab. The Prophet ﷺ had promised the relay itself: "Allah will raise for this ummah, at the head of every century, one who renews for it its religion" (Abu Dawud 4291).

The Codex sets this chapter between the caliphs and the nations deliberately: before the light could cross the earth, it had to be made tamper-proof. It was. The reader holding any mushaf, citing any sahih hadith, is holding the receipts.`,
facts:[
 {label:"The promise",value:"15:9, Guardian named"},
 {label:"Double custody",value:"Written mushaf + living huffaz"},
 {label:"The invention",value:"Isnad: chains with biographies"},
 {label:"Bukhari's sieve",value:"600,000 → ~7,000 · 16 years"},
 {label:"Guard-sciences",value:"Grammar · usul · four madhhabs"},
 {label:"The relay",value:"A renewer every century"}],
quran:[
 {ref:"15:9",ar:"إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ",en:"Indeed, We sent down the Reminder, and indeed We are its Guardian."}],
hadith:[
 {text:"Allah will raise for this ummah at the head of every century one who renews for it its religion.",source:"Abu Dawud 4291 (sahih)"},
 {text:"Ibn al-Mubarak said: the isnad is part of the religion; were it not for the isnad, whoever wished would have said whatever he wished.",source:"Muqaddimah of Sahih Muslim"}],
lessons:[
 "Divine guardianship worked through human diligence: the promise hired the scholars",
 "Ask every claim for its chain: the isnad instinct is this ummah's inheritance",
 "Memorization plus manuscript is double-entry bookkeeping for revelation"],
connections:[49,52,30]
}},

// ——— 52 · Light across the Nations ———
{id:52, insert:{
period:"umam",
titleEn:"Al-Umam: Light across the Nations",
titleAr:"الأمم",
metric:"“Where night and day reach”",
summary:"From one city with no army to a quarter of mankind: the promise that this matter would reach wherever night and day reach, kept.",
pattern:"pattern-umam",
details:`The Prophet ﷺ made a geographic forecast at a time when {{p:p-madinah|his city}} could barely defend its own date groves: "This matter will reach wherever the night and the day reach; Allah will not leave a house of mud or of hair except that He will bring this religion into it" (Ahmad 16957, sahih). This chapter is the audit of that sentence.

In one generation the openings carried the adhan from {{p:p-jerusalem|al-Quds}} to Persia's plateau and {{p:p-egypt|the Nile}}. Within a century it sounded from the Atlantic edge of the Maghrib and al-Andalus to the Indus. But the map's most instructive regions were never conquered at all: the light crossed oceans in merchants' ledgers and teachers' satchels. East and West Africa took Islam along the caravan and monsoon routes; the Malay archipelago, today's largest Muslim populations among them, met the religion through traders whose honesty was the sermon; China's early mosques rose in port cities on the Silk and spice roads. {{c:c-bilal|An Abyssinian}} had given Islam its first voice, {{c:c-salman|a Persian}} its first foreign seeker, {{c:c-ibnsalam|a rabbi}} its first scriptural witness: the ummah was multinational before it was even safe.

The Qur'an had declared the design early: "We made you nations and tribes so that you may know one another; the noblest of you with Allah is the most conscious of Him" (49:13), and the commission: "a middle nation, that you may be witnesses over mankind" (2:143). Fourteen centuries on, the audit stands at roughly a quarter of the human race, praying in every time zone, so that at no minute of any day is the earth without a congregation facing {{p:p-kaaba|the House}}: the adhan circles the planet in a relay that never lands.

The chapter closes where the Path bends toward {{n:53|its final book}}: the Prophet ﷺ promised that a company of this ummah will remain manifest upon the truth, unharmed by those who forsake them, until Allah's command comes (Muslim 1920). Nations rose and fell around that sentence for fourteen hundred years; the sentence has not moved. The reader is invited to check it against the nearest minaret.`,
facts:[
 {label:"The forecast",value:"Every house, mud or hair"},
 {label:"One generation",value:"Al-Quds · Persia · Egypt"},
 {label:"Unconquered converts",value:"Trade routes: Africa · Malay · China"},
 {label:"Design",value:"49:13: nations, to know one another"},
 {label:"Today",value:"~1 in 4 of mankind"},
 {label:"Standing promise",value:"A company manifest till the command"}],
quran:[
 {ref:"49:13",ar:"وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا ۚ إِنَّ أَكْرَمَكُمْ عِندَ اللَّهِ أَتْقَاكُمْ",en:"We made you peoples and tribes that you may know one another; the noblest of you with Allah is the most God-conscious."},
 {ref:"2:143",ar:"وَكَذَٰلِكَ جَعَلْنَاكُمْ أُمَّةً وَسَطًا لِّتَكُونُوا شُهَدَاءَ عَلَى النَّاسِ",en:"Thus We made you a middle nation, that you may be witnesses over mankind."}],
hadith:[
 {text:"This matter will reach wherever the night and the day reach; Allah will not leave a house of mud or of hair except that He will bring this religion into it.",source:"Ahmad 16957 (sahih)"},
 {text:"A company of my ummah will remain manifest upon the truth, unharmed by those who forsake them, until the command of Allah comes.",source:"Muslim 1920"}],
lessons:[
 "Honest trade preached continents that armies never entered",
 "The ummah's diversity is not a complication of the design: it is the design (49:13)",
 "A fourteen-century forecast, checkable at the nearest minaret, is its own miracle class"],
connections:[51,53,42]
}}
]
};
