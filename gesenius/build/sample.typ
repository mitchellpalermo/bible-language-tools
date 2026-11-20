#import "gesenius.typ": *
#show: book

#page(margin: 0pt, header: none, footer: none, numbering: none)[
  #block(width: 100%, height: 6pt, fill: accent-gradient)
  #block(width: 100%, height: 3.35in, fill: primary, inset: (x: 0.75in, top: 0.9in))[
    #set text(font: sans, fill: white)
    #text(size: 15pt, weight: "bold", tracking: 0.12em, fill: accent-light)[GESENIUS’]
    #v(0.06in)
    #text(size: 34pt, weight: "extrabold", tracking: -0.01em)[Hebrew\ Grammar]
  ]
  #block(width: 100%, inset: (x: 0.75in, top: 0.45in))[
    #set text(font: sans, fill: ink)
    #set par(justify: false, leading: 0.5em)
    #text(size: 8.5pt, tracking: 0.08em, fill: muted)[AS EDITED AND ENLARGED BY THE LATE]
    #v(0.04in)
    #text(size: 15pt, weight: "bold", fill: primary)[E. Kautzsch]
    #v(0.0in)
    #text(size: 7.5pt, tracking: 0.06em, fill: muted)[PROFESSOR OF THEOLOGY IN THE UNIVERSITY OF HALLE]
    #v(0.28in)
    #text(size: 9.5pt, weight: "bold", tracking: 0.08em)[SECOND ENGLISH EDITION]
    #v(0.04in)
    #text(size: 8.5pt, tracking: 0.06em, fill: muted)[REVISED IN ACCORDANCE WITH THE TWENTY-EIGHTH\ GERMAN EDITION (1909) BY]
    #v(0.04in)
    #text(size: 15pt, weight: "bold", fill: primary)[A. E. Cowley]
    #v(0.28in)
    #text(size: 7.5pt, tracking: 0.06em, fill: muted)[WITH A FACSIMILE OF THE SILOAM INSCRIPTION BY J. EUTING,\ AND A TABLE OF ALPHABETS BY M. LIDZBARSKI]
  ]
  #place(bottom + left, dx: 0.75in, dy: -0.7in)[
    #set text(font: sans)
    #block(width: 0.9in, height: 2pt, fill: accent)
    #v(0.06in)
    #text(size: 9pt, weight: "bold", tracking: 0.1em, fill: ink)[OXFORD]\
    #text(size: 8pt, tracking: 0.08em, fill: muted)[AT THE CLARENDON PRESS]
  ]
  #place(bottom + right, dx: -0.6in, dy: -0.55in,
    text(font: hebrew-font, size: 64pt, fill: rule, [א]))
]


#page(header: none, footer: none)[
  #set text(font: sans, size: 7.5pt, fill: muted)
  #set par(justify: false)
  #v(1fr)
  #align(center)[
    SECOND ENGLISH EDITION 1910 \
    #v(2pt)
    Reprinted lithographically in Great Britain at the University Press, Oxford,\
    1946, 1949, 1952, 1956, from corrected sheets of the second edition
    #v(4pt)
    #text(size: 6.5pt)[(the imprint of the copy scanned by the Internet Archive)]
  ]
  #v(0.4in)
]


#page(header: none)[
  #set par(justify: false)
  #v(0.15in)
  #block(width: 100%, height: 3pt, fill: accent-gradient)
  #v(0.12in)
  #text(font: sans, size: 15pt, weight: "extrabold", fill: primary)[About this edition]
  #v(0.08in)
  #block(width: 100%, fill: bg, radius: 5pt, stroke: 0.8pt + rule, inset: 10pt)[
    #text(weight: "bold", fill: ink)[This edition has been reformatted by an artificial intelligence tool.]
    The text, the Hebrew, and the tables were re-set by software rather than by a human editor, so errors are possible. Where anything matters, check it against the original printing.
  ]
  #v(0.06in)
  #grid(columns: (1fr, 1.15in), column-gutter: 14pt,
    [
      #set text(size: 8.4pt)
      *What is the same.* The words of Gesenius, Kautzsch and Cowley, including every section number (§) and paragraph letter (_a_, _b_, _c_…), which stand in the outer margin as they did in 1910, so citations like §22#emph[c] still find their place.

      *What changed.* Modern type and layout. Scripture references are given in the modern form (#bref("1 Sam 15:6") for _1 S 15⁶_; #bref("Ps 52:5") for _ψ 52⁵_). A few old spellings are updated: connexion → connection, inflexion → inflection, reflexion → reflection, shew, shewn → show, shown, whilst → while, amongst → among, to-day, to-morrow → today, tomorrow, &c. → etc., viz. → namely. Glosses such as _ye have killed_ keep their _thou_ and _ye_, since those mark singular and plural.

      *Checking a page.* The small grey numbers in the inner margin (#text(fill: muted, size: 7pt)[p.#h(1pt)76]) mark where each page of the 1910 printing began.

      *Sources.* The running text comes from the volunteer transcription of this edition on English Wikisource. The paradigms were checked against the scan form by form, because Wikisource's paradigm pages are unproofread and contain errors. Notes added by Wikisource's editors are left out.
    ],
    [
      #align(center)[
        #box(stroke: 0.8pt + rule, radius: 5pt, inset: 7pt, image("scan-qr.svg", width: 100%))
        #v(4pt)
        #text(size: 7.5pt, weight: "bold", fill: primary)[If you desire to verify against the original scan here]
      ]
    ],
  )
  #v(1fr)
  #text(size: 6.5pt, fill: muted)[Original scan: archive.org/details/geseniushebrewgr00geseuoft. Public domain.]
]


#page(header: none)[
  #text(font: sans, size: 15pt, weight: "extrabold", fill: primary)[Contents]
  #v(0.15in)
  #show outline.entry.where(level: 1): it => { v(6pt); strong(text(fill: primary, it)) }
  #outline(title: none, depth: 3, indent: 1em)
]

#counter(page).update(1)

= First Part: Elementary Principles, or the Sounds and Characters

== Chapter II. Peculiarities and Changes of Letters: the Syllable and the Tone

#sec("22", [Peculiarities of the Gutturals], note: []) <s22>

#ml("a") <p22a> The four gutturals #he[ח];, #he[ה];, #he[ע];, #he[א];, in consequence of their peculiar pronunciation, have special characteristics, but #he[א];, as the weakest of these sounds, and sometimes also #he[ע]; (which elsewhere as one of the harder gutturals is the opposite of #he[א];), differ in several respects from the stronger #he[ה]; and #he[ח];.

#ml("b") <p22b> #strong[1.]; They do not admit of #emph[Dageš forte];, since, in consequence of a gradual weakening of the pronunciation (see below, note 2), the strengthening of the gutturals was hardly audible to the Masoretes. But a distinction must be drawn between (#emph[a];) the complete omission of the strengthening, and (#emph[b];) the mere #emph[echo]; of it, commonly called #emph[half]; doubling, but better, #emph[virtual]; strengthening.

#ml("c") <p22c> In the former case, the short vowel before the guttural would stand in an open syllable, and must accordingly be lengthened or modified.#footnote[Cf. #emph[terra]; and the French #emph[terre];, the German #emph[Rolle]; and the French #emph[rôle];; German #emph[drollig]; and French #emph[drôle];. The omission of the strengthening shows a deterioration of the language. Arabic still admits of the strengthening of gutturals in all cases.]; #origpage("77");For a distinction must again be drawn between the full lengthening of #emph[Pathaḥ]; into #emph[Qameṣ];—mostly before #he[א]; (#emph[always]; under the #he[ה]; of the article, see #xref(<s35>)[§ 35];), as a rule also before #he[ע];, less frequently before #he[ה];, and least often before #he[ח];—and the modification of #emph[Pathaḥ]; to #emph[S#super[e];ghôl];, mostly before a guttural with #emph[Qameṣ];. In the other case (#emph[virtual]; strengthening) the #emph[Dageš]; is still omitted, but the strengthening is nevertheless regarded as having taken place, and the preceding vowel therefore remains short. This #emph[virtual]; strengthening occurs most frequently with #he[ח];, usually with #he[ה];, less frequently with #he[ע];, and very seldom with #he[א];. Examples of (#emph[a];) #he[מֵאֵן];, #he[הָֽאָדָם];, #he[הָעָם];, #he[הָהָר];, #he[יֵֽחָבֵא]; (for #emph[yiḥḥābhēʾ];); also #he[אֶחָד];, #he[הֶחָג];, #he[הֶֽהָרִים];, #he[הֶֽעָנִי]; (see more fully on the pointing of the article before #he[ע]; in #xref(<s35>)[§ 35];).—Of (#emph[b];) #he[הַחֹ֫דֶשׁ];, #he[מִחוּט]; (from #emph[minḥûṭ];), #he[הַהוּא];, #he[בִּעֵר];, #he[נִאֵץ];, etc.—In all these cases of virtual strengthening the #emph[Dageš forte]; is to be regarded at least as implied (hence called #emph[Dageš forte implicitum, occultum];, or #emph[delitescens];).

#ml("d") <p22d> #strong[2.]; They prefer before them, and sometimes after them (cf. #xref(<p22h>)[#emph[h];];), a short A\-sound, because this vowel is organically the nearest akin to the gutturals. Hence

(#emph[a];) before a guttural, #emph[Pathaḥ]; readily (and always before #he[הּ];, #he[ח];, #he[ע]; closing a syllable) takes the place of another short vowel or of a rhythmically long #emph[ē]; or #emph[ō];, e.g. #he[זֶ֫בַח]; #emph[sacrifice];, not #emph[zèbĕḥ];; #he[שֵׁ֫מַע]; #emph[report];, not #emph[šēmĕʿ];. This is more especially so when #emph[a]; was the original vowel of the form, or is otherwise admissible. Thus in the Imperat. and Imperf. Qal of guttural verbs, #he[שְׁלַח]; #emph[send thou];, #he[יִשְׁלַח]; #emph[he will send]; (not #emph[yišlōḥ];); Perf. Piʿel #he[שִׁלַּח]; (but in Pausa #he[שִׁלֵּחַ];); #he[יַחְמֹד]; #emph[he will desire]; (not #emph[yiḥmōd];) ; #he[וַיָּ֫נַח]; #emph[and he rested]; (not #emph[wayyānŏḥ];); #he[נַ֫עַר]; #emph[a youth];. In #he[שִׁלַּח]; and #he[יַחְמֹד]; #emph[ă]; is the original vowel.

#ml("e") <p22e> Rem. In such cases as #he[דֶּ֫שֶָׁא];, #he[טֶ֫נֶא];, #he[פֶּ֫לֶא];, #he[פֶּ֫רֶא];, the #he[א]; has no consonantal value, and is only retained orthographically (see #xref(<p23a>)[§ 23#emph[a];];).

#ml("f") <p22f> (#emph[b];) After a heterogeneous long vowel, i.e. after all except #emph[Qameṣ];, the hard gutturals#footnote[Prätorius, #emph[Ueber den rückweich. Accent im Hebr.];, Halle, 1897, p. 17, etc., remarks that Pathaḥ furtivum has not arisen merely under the influence of the guttural, but is due to a duplication of the accented syllable, so that e.g. #he[יָשִׁיב];, #he[יָצוּד]; would also be pronounced #emph[yasî#super[i];bh, yaṣû#super[u];dh]; although the short intermediate vowel was not so noticeable as before a guttural.]; (consequently not #he[א];), when standing at the end of the word, require the insertion of a rapidly uttered #emph[ă]; (#emph[Pathaḥ furtivum];) between themselves and the vowel. This #emph[Pathaḥ]; is placed under the guttural, but sounded #emph[before]; it. It is thus merely an orthographic indication not to neglect the guttural sound in pronunciation, e.g. #he[רוּחַ]; #emph[rû#super[a];ḥ];, #he[נוֹעַ];, #he[רֵעַ];, #he[הִשְׁלִיחַ];, #he[גָּבוֹהַּ];, (when consonantal #he[ה]; is #origpage("78");final it necessarily takes Mappîq), but e.g. #he[רוּחִי];, etc., since here the rapidly uttered #emph[ă]; is no longer heard.

#ml("g") <p22g> #emph[I#super[a];ch]; for #emph[ich];, etc., in some Swiss dialects of German, is analogous; a #emph[furtive Pathaḥ]; is here involuntarily intruded before the deep guttural sound. In Arabic the same may be heard in such words as #emph[mesîaḥ];, although it is not expressed in writing. The LXX (and Jerome, cf. #emph[ZAW.]; iv. 79) write #greek[ε];, sometimes #greek[α];, instead of #emph[furtive Pathaḥ];, e.g. #he[נֹחַ]; #greek[Νῶε];, #he[יַדּוּעַ]; #greek[Ίεδδούα]; (also #greek[Ίαδδού];).

#ml("h") <p22h> Rem. 1. The guttural may also have an influence upon the #emph[following]; vowel, especially in Segholate forms, e.g. #he[נַ֫עַר]; (not #emph[naʿĕr];) #emph[a youth];, #he[פֹּ֫עַל]; (not #emph[pōʿĕl];) #emph[deed];. The only exceptions are #he[אֹהֶל];, #he[בֹּהֶן];, #he[לֶחֶם];, #he[רֶחֶם];.

#ml("i") <p22i> 2. Where in the present form of the language an #emph[ĭ];, whether original or attenuated from #emph[Pathaḥ];, would stand before or after a guttural in the first syllable of a word, a #emph[S#super[e];ghôl]; as being between #emph[ă]; and #emph[ĭ]; is frequently used instead, e.g. #he[יֶחְבַּשׁ]; (also #he[יַֽחֲבֹשׁ];), #he[יֶהְגּוּ];, #he[חֶבְלֵי];, #he[נֶאְדָּר];, #he[עֶזְרִי];, etc.

#ml("k") <p22k> On the other hand, the slighter and sharper #emph[Ḥireq]; is retained even under gutturals when the following consonant is sharpened by #emph[Dageš forte];, e.g. #he[הִלֵּל];, #he[הִנֵּה];, #he[חִטָּה];; but when this sharpening is removed, S#super[e];ghôl is again apt to appear, e.g. #he[הִגָּיוֹן]; constr. #he[הֶגְיוֹן];, #he[חִזָּיוֹן]; constr. #he[חֶזְיוֹן];.

#ml("l") <p22l> #strong[3.]; Instead of #emph[simple Š#super[e];wâ mobile];, the gutturals take without exception a compound #emph[Š#super[e];wâ];, e.g. #he[שָֽׁחֲטוּ];, #he[אֲקַטֵּל];, #he[אֱמֹר];, #he[אֳנִי];, etc.

#ml("m") <p22m> #strong[4.]; When a guttural with #emph[quiescent Š#super[e];wâ]; happens to close a syllable in the middle of a word, the strongly closed syllable (with #emph[quiescent Š#super[e];wâ];) may remain; necessarily so with #he[ח];, #he[ע];, and #he[ה]; at the end of the tone\-syllable, e.g. #he[שָׁלַ֫חְתָּ];, #he[יָדַ֫עְתָּ];, but also #emph[before]; the tone (see examples under i), even with #he[א];.

But in the syllable before the tone and further back, the closed syllable is generally opened artificially by a #emph[Ḥaṭeph]; (as being suited to the guttural) taking the place of the #emph[quiescent Š#super[e];wâ];, and in particular that #emph[Ḥaṭeph]; which repeats the sound of the preceding vowel, e.g. #he[יֽחֲשֹׁב]; (also #he[יַחְשֹׁב];); #he[יֶחֱֽזַק]; (also #he[יֶחְזַק];); #he[פָּֽעֳלוֹ]; #emph[pŏ#super[o];lô]; (for #emph[pŏʿlô];). But when, owing to a flexional change, the strong vowel following the #emph[Ḥaṭeph]; is weakened into #emph[Š#super[e];wâ mobile];, then instead of the #emph[Ḥaṭeph]; its fall vowel is written, e.g. #he[יַֽעַמְדוּ]; (from #he[יַֽעֲמֹד];), #he[נֶֽעֶרְמוּ];, #he[פָּֽעָלְךָ]; (from #he[פֹּעַל];). The original forms, according to #xref(<p28c>)[§ 28#emph[c];];, were #emph[yaʿm#super[e];dhû, neʿr#super[e];mû, pŏʿl#super[e];khā];. Hence #he[יַֽעַמְדוּ];, etc., are really only different orthographic forms of #he[יַֽעֲמְדוּ];, etc., and would be better transcribed by #emph[yaʿ#super[a];m#super[e];dhû];, etc.

#ml("n") <p22n> Rem. 1. On the use of simple or compound Š#super[e];wâ in guttural verbs, see further §§ 62–65.

#ml("o") <p22o> 2. Respecting the choice between the three #emph[Ḥaṭephs];, it may be remarked:

(#emph[a];) #he[ח];, #he[ה];, #he[ע]; at the beginning of a syllable prefer #he[־ֲ];, but #he[א]; prefers #he[־ֱ];, e.g. #he[חֲמוֹר]; #emph[ass];, #he[הֲרֹג]; #emph[to kill];, #he[אֱמֹר]; #emph[to say];; when farther from the tone syllable, however, the #he[־ֱ]; even under #he[א]; changes into the lighter #he[־ֲ];, e.g. #he[אֱלֵי]; (poetic for #he[אֶל־];) #emph[to];, but #he[אֲלֵיכֶ֫ם]; #emph[to you];, #he[אֱכֹל]; #emph[to eat];, but #he[אֲכָל־]; (#emph[ʾ#super[a];khŏl];, toneless on account #origpage("79");of Maqqēph). Cf. #xref(<p27w>)[§ 27#emph[w];];. The 1st pets. sing. imperf. Piʿēl regularly has #he[־ֲ];. Likewise #he[־ֲ]; is naturally found under #he[א]; in cases where the #emph[Ḥaṭeph]; arises from a weakening of an original #emph[ă]; (e.g. #he[אֲרִי]; #emph[lion];, ground\-form #emph[ʾary];), and #he[־ֳ]; if there be a weakening of an original #emph[u]; (e.g. #he[אֳנִי]; #emph[a fleet];, #he[עֳנִי]; #emph[affliction];, cf. #xref(<p93q>)[§ 93#emph[q];];, #xref(<p93z>)[#emph[z];];).

#ml("p") <p22p> (#emph[b];) In the middle of a word after a long vowel, a #emph[Ḥaṭeph\-Pathaḥ]; takes the place of a #emph[simple Š#super[e];wâ mobile];, e.g. #he[הֹֽעֲלָה מֵֽאֲנָה]; (see #xref(<p63p>)[§ 63#emph[p];];); but if a short vowel precedes, the choice of the #emph[Ḥaṭeph]; is generally regulated by it, e.g. #emph[Perf. Hiph.]; #he[הֶֽעֱמִיד]; (see above, #xref(<p22i>)[#emph[i];];), #emph[Infin.]; #he[הַֽעֲמִיד]; (regular form #he[הַקְטִיל];); #emph[Perf. Hoph.]; #he[הָֽעֳמַד]; (regular form #he[הָקְטַל];); but cf. #he[שִֽׁחֲדוּ]; #bref("Job 6:22"); (#xref(<p64a>)[§ 64#emph[a];];).

#ml("q") <p22q> #strong[5.]; The #he[ר];, which in sound approximates to the gutturals (#xref(<p6g>)[§ 6#emph[g];];), shares with the gutturals proper their first, and to a certain extent their second, peculiarity, namely

(#emph[a];) The exclusion of the strengthening, instead of which the preceding vowel is almost always lengthened, e.g. #he[בֵּרַךְ]; #emph[he has blessed]; for #emph[birrakh];, #he[בָּרֵךְ]; #emph[to bless]; for #emph[barrēkh];.

#ml("r") <p22r> (#emph[b];) The preference for #emph[ă]; as a preceding vowel, e.g. #he[וַיַּרְא]; #emph[and he saw]; (from #he[יִרְאֶה];); #he[וַיָּ֫סַר]; both for #he[וַיָּ֫סָר]; #emph[and he turned back];, and for #he[וַיָּ֫סֶר]; #emph[and he caused to turn back];.

#ml("s") <p22s> The exceptions to #emph[a]; are #he[מָרַּת]; #emph[mŏrrăth];, #bref("Prov 14:10");; #he[כָרַּת]; #emph[khŏrrăth]; and #he[שָׁרֵּךְ]; #emph[šŏrrēkh];, #bref("Ezek 16:4"); (cf. #bref("Prov 3:8");); #he[שֶׁרֹּאשִׁי]; #bref("Song 5:2");; #he[הַרְּעִמָהּ]; #bref("1 Sam 1:6");; #he[הַרְּאִיתֶם]; #bref("1 Sam 10:24");, #bref("17:25");, #bref("2 Kgs 6:32");; exceptions to #emph[b]; are #he[הִרִּדִיפֻהוּ]; #bref("Judg 20:43"); (cf. #xref(<p20h>)[§ 20#emph[h];];); #he[מִרְּדֹף]; #bref("1 Sam 23:28");, #bref("2 Sam 18:16");; also on account of #he[דחיק]; (#xref(<p20c>)[§ 20#emph[c];];), #bref("Prov 15:1");, #bref("20:22");, #bref("2 Chr 26:10");; and on account of #he[אתי מרחיק]; (#xref(<p20f>)[§ 20#emph[f];];) #bref("1 Sam 15:6");, #bref("Jer 39:12");, #bref("Ps 52:5");, #bref("Hab 3:13");, #bref("Prov 11:21");, #bref("Job 39:9");, #bref("Ezra 9:6");. A kind of virtual strengthening (after #he[מִ‍]; for #he[מִן];) is found in #he[מִֽרָגְזֶךָ]; #bref("Isa 14:3");. In Samaritan and Arabic this strengthening has been retained throughout, and the LXX write e.g. #greek[Σάῤῥα]; for #he[שָׂרָה];. \[So Baer (cf. his note on #bref("Judg 20:43");; also on #bref("Jer 39:12");, and several of the other passages in question): but Ginsburg only in 10 of the exceptions to #emph[b];, and Jacob ben Ḥayyim and Kittel only in 5, namely #bref("Jer 39:12");, #bref("Prov 11:21");, #bref("15:1");, #bref("Ps 52:5");, #bref("Ezra 9:6");.—#box[S. R. D.];\]

= Paradigms

#parhead("B", "Strong Verb");

#origpage("510");
#ptable("Qal · Niphʿal · Piʿēl", 5, ([], [], table.cell(colspan: 3, align: center)[#text(fill: primary, weight: "bold")[Qal]], table.cell(colspan: 1, align: center)[#text(fill: primary, weight: "bold")[Niphʿal]], table.cell(colspan: 1, align: center)[#text(fill: primary, weight: "bold")[Piʿēl]]), ([#emph[Perf. Sing.];], [3 #emph[m];], [#box[#pform("קָטַל", true);];], [#box[#pform("כָּבֵד", true);];], [#box[#pform("קָטֹן", true);];], [#box[#pform("נִקְטַל", true);];], [#box[#pform("קִטַּל", false);, #pform("קִטֵּל", true);];], [], [3 #emph[f];], [#box[#pform("קָֽטְלָה", true);];], [#box[#pform("כָּֽבְדָה", true);];], [#box[#pform("קָֽטְנָה", true);];], [#box[#pform("נִקְטְלָה", true);];], [#box[#pform("קִטְּלָה", true);];], [], [2 #emph[m];], [#box[#pform("קָטַ֫לְתָּ", true);];], [#box[#pform("כָּבַ֫דְתָּ", true);];], [#box[#pform("קָטֹ֫נְתָּ", true);];], [#box[#pform("נִקְטַ֫לְתָּ", true);];], [#box[#pform("קִטַּ֫לְתָּ", true);];], [], [2 #emph[f];], [#box[#pform("קָטַלְתְּ", false);];], [#box[#pform("כָּבַדְתְּ", false);];], [#box[#pform("קָטֹנְתְּ", false);];], [#box[#pform("נִקְטַלְתְּ", false);];], [#box[#pform("קִטַּלְתְּ", false);];], [], [1 #emph[c];], [#box[#pform("קָטַ֫לְתִּי", false);];], [#box[#pform("כָּבַ֫דְתִּי", false);];], [#box[#pform("קָטֹ֫נְתִּי", false);];], [#box[#pform("נִקְטַ֫לְתִּי", false);];], [#box[#pform("קִטַּ֫לְתִּי", false);];], [#emph[Plur.];], [3 #emph[c];], [#box[#pform("קָֽטְלוּ", false);];], [#box[#pform("כָּֽבְדוּ", false);];], [#box[#pform("קָֽטְנוּ", false);];], [#box[#pform("נִקְטְלוּ", false);];], [#box[#pform("קִטְּלוּ", false);];], [], [2 #emph[m];], [#box[#pform("קְטַלְתֶּם", true);];], [#box[#pform("כְּבַדְתֶּם", true);];], [#box[#pform("קְטָנְתֶּם", true);];], [#box[#pform("נִקְטַלְתֶּם", false);];], [#box[#pform("קִטַּלְתֶּם", false);];], [], [2 #emph[f];], [#box[#pform("קְטַלְתֶּן", false);];], [#box[#pform("כְּבַדְתֶּן", false);];], [#box[#pform("קְטָנְתֶּן", false);];], [#box[#pform("נִקְטַלְתֶּן", false);];], [#box[#pform("קִטַּלְתֶּן", false);];], [], [1 #emph[c];], [#box[#pform("קָטַ֫לְנוּ", false);];], [#box[#pform("כָּבַ֫דְנוּ", false);];], [#box[#pform("קָטֹ֫נּוּ", false);];], [#box[#pform("נִקְטַ֫לְנוּ", false);];], [#box[#pform("קִטַּ֫לְנוּ", false);];], table.hline(stroke: 0.6pt + primary), [#emph[Inf.];], [], [#box[#pform("קְטֹל", false);, #pform("שְׁכַב", true);];], [], [], [#box[#pform("הִקָּטֵל", true);];], [#box[#pform("קַטֵּל", true);];], [#emph[Inf. absol.];], [], [#box[#pform("קָטוֹל", true);];], [], [], [#box[#pform("נִקְטֹל", false);, #pform("הִקָּטֹל", true);];], [#box[#pform("קַטֵּל", false);, #pform("קַטֹּל", true);];], table.hline(stroke: 0.6pt + primary), [#emph[Imp. Sing.];], [2 #emph[m];], [#box[#pform("קְטֹל", true);];], [#box[#pform("כְּבַד", true);];], [], [#box[#pform("הִקָּטֵל", true);];], [#box[#pform("קַטֵּל", true);];], [], [2 #emph[f];], [#box[#pform("קִטְלִי", true);];], [#box[#pform("כִּבְדִי", true);];], [], [#box[#pform("הִקָּֽטְלִי", true);];], [#box[#pform("קַטְּלִי", true);];], [#emph[Plur.];], [2 #emph[m];], [#box[#pform("קִטְלוּ", false);];], [#box[#pform("כִּבְדוּ", false);];], [], [#box[#pform("הִקָּֽטְלוּ", false);];], [#box[#pform("קַטְּלוּ", false);];], [], [2 #emph[f];], [#box[#pform("קְטֹ֫לְנָה", true);];], [#box[#pform("כְּבַ֫דְנָה", true);];], [], [#box[#pform("הִקָּטַ֫לְנָה", true);];], [#box[#pform("קַטֵּ֫לְנָה", true);];], table.hline(stroke: 0.6pt + primary), [#emph[Impf. Sing.];], [3 #emph[m];], [#box[#pform("יִקְטֹל", true);];], [#box[#pform("יִכְבַּד", true);];], [#box[#pform("יִקְטַן", true);];], [#box[#pform("יִקָּטֵל", true);];], [#box[#pform("יְקַטֵּל", true);];], [], [3 #emph[f];], [#box[#pform("תִּקְטֹל", false);];], [#box[#pform("תִּכְבַּד", false);];], [], [#box[#pform("תִּקָּטֵל", false);];], [#box[#pform("תְּקַטֵּל", false);];], [], [2 #emph[m];], [#box[#pform("תִּקְטֹל", false);];], [#box[#pform("תִּכְבַּד", false);];], [], [#box[#pform("תִּקָּטֵל", false);];], [#box[#pform("תְּקַטֵּל", false);];], [], [2 #emph[f];], [#box[#pform("תִּקְטְלִי", true);];], [#box[#pform("תִּכְבְּדִי", true);];], [], [#box[#pform("תִּקָּֽטְלִי", true);];], [#box[#pform("תְּקַטְּלִי", true);];], [], [1 #emph[c];], [#box[#pform("אֶקְטֹל", false);];], [#box[#pform("אֶכְבַּד", false);];], [], [#box[#pform("אֶקָּטֵל", false);];], [#box[#pform("אֲקַטֵּל", false);];], [#emph[Plur.];], [3 #emph[m];], [#box[#pform("יִקְטְלוּ", false);];], [#box[#pform("יִכְבְּדוּ", false);];], [], [#box[#pform("יִקָּֽטְלוּ", false);];], [#box[#pform("יְקַטְּלוּ", false);];], [], [3 #emph[f];], [#box[#pform("תִּקְטֹ֫לְנָה", true);];], [#box[#pform("תִּכְבַּ֫דְנָה", true);];], [], [#box[#pform("תִּקָּטַ֫לְנָה", true);];], [#box[#pform("תְּקַטֵּ֫לְנָה", true);];], [], [2 #emph[m];], [#box[#pform("תִּקְטְלוּ", false);];], [#box[#pform("תִּכְבְּדוּ", false);];], [], [#box[#pform("תִּקָּֽטְלוּ", false);];], [#box[#pform("תְּקַטְּלוּ", false);];], [], [2 #emph[f];], [#box[#pform("תִּקְטֹ֫לְנָה", false);];], [#box[#pform("תִּכְבַּ֫דְנָה", false);];], [], [#box[#pform("תִּקָּטַ֫לְנָה", false);];], [#box[#pform("תְּקַטֵּ֫לְנָה", false);];], [], [1 #emph[c];], [#box[#pform("נִקְטֹל", false);];], [#box[#pform("נִכְבַּד", false);];], [], [#box[#pform("נִקָּטֵל", false);];], [#box[#pform("נְקַטֵּל", false);];], table.hline(stroke: 0.6pt + primary), table.cell(colspan: 7)[#emph[Shortened Impf. (Jussive)];], table.hline(stroke: 0.6pt + primary), [#emph[Part. act.];], [], [#box[#pform("קֹטֵל", true);];], [#box[#pform("כָּבֵד", false);];], [#box[#pform("קָטֹן", false);];], [#box[#pform("נִקְטָל", true);];], [#box[#pform("מְקַטֵּל", true);];], [#emph[Part. pass.];], [], [#box[#pform("קָטוּל", true);];], [], [], [], [],));

#pagebreak(weak: true)

#origpage("511");
#ptable("Puʿal · Hiphʿîl · Hophʿal · Hithpaʿēl", 4, ([], [], table.cell(colspan: 1, align: center)[#text(fill: primary, weight: "bold")[Puʿal]], table.cell(colspan: 1, align: center)[#text(fill: primary, weight: "bold")[Hiphʿîl]], table.cell(colspan: 1, align: center)[#text(fill: primary, weight: "bold")[Hophʿal]], table.cell(colspan: 1, align: center)[#text(fill: primary, weight: "bold")[Hithpaʿēl]]), ([#emph[Perf. Sing.];], [3 #emph[m];], [#box[#pform("קֻטַּל", true);];], [#box[#pform("הִקְטִיל", true);];], [#box[#pform("הָקְטַל", true);];], [#box[#pform("הִתְקַטֵּל", true);];], [], [3 #emph[f];], [#box[#pform("קֻטְּלָה", true);];], [#box[#pform("הִקְטִ֫ילָה", true);];], [#box[#pform("הָקְטְלָה", true);];], [#box[#pform("הִתְקַטְּלָה", true);];], [], [2 #emph[m];], [#box[#pform("קֻטַּ֫לְתָּ", true);];], [#box[#pform("הִקְטַ֫לְתָּ", true);];], [#box[#pform("הָקְטַ֫לְתָּ", true);];], [#box[#pform("הִתְקַטַּ֫לְתָּ", true);];], [], [2 #emph[f];], [#box[#pform("קֻטַּלְתְּ", false);];], [#box[#pform("הִקְטַלְתְּ", false);];], [#box[#pform("הָקְטַלְתְּ", false);];], [#box[#pform("הִתְקַטַּלְתְּ", false);];], [], [1 #emph[c];], [#box[#pform("קֻטַּ֫לְתִּי", false);];], [#box[#pform("הִקְטַ֫לְתִּי", false);];], [#box[#pform("הָקְטַ֫לְתִּי", false);];], [#box[#pform("הִתְקַטַּ֫לְתִּי", false);];], [#emph[Plur.];], [3 #emph[c];], [#box[#pform("קֻטְּלוּ", false);];], [#box[#pform("הִקְטִ֫ילוּ", false);];], [#box[#pform("הָקְטְלוּ", false);];], [#box[#pform("הִתְקַטְּלוּ", false);];], [], [2 #emph[m];], [#box[#pform("קֻטַּלְתֶּם", false);];], [#box[#pform("הִקְטַלְתֶּם", false);];], [#box[#pform("הָקְטַלְתֶּם", false);];], [#box[#pform("הִתְקַטַּלְתֶּם", false);];], [], [2 #emph[f];], [#box[#pform("קֻטַּלְתֶּן", false);];], [#box[#pform("הִקְטַלְתֶּן", false);];], [#box[#pform("הָקְטַלְתֶּן", false);];], [#box[#pform("הִתְקַטַּלְתֶּן", false);];], [], [1 #emph[c];], [#box[#pform("קֻטַּ֫לְנוּ", false);];], [#box[#pform("הִקְטַ֫לְנוּ", false);];], [#box[#pform("הָקְטַ֫לְנוּ", false);];], [#box[#pform("הִתְקַטַּ֫לְנוּ", false);];], table.hline(stroke: 0.6pt + primary), [#emph[Inf.];], [], [#text(fill: muted, style: "italic")[wanting.];], [#box[#pform("הַקְטִיל", true);];], [#text(fill: muted, style: "italic")[wanting.];], [#box[#pform("הִתְקַטֵּל", true);];], [#emph[Inf. absol.];], [], [#box[#pform("קֻטֹּל", true);];], [#box[#pform("הַקְטֵל", true);];], [#box[#pform("הָקְטֵל", true);];], [#box[#pform("הִתְקַטֵּל", true);];], table.hline(stroke: 0.6pt + primary), [#emph[Imp. Sing.];], [2 #emph[m];], table.cell(rowspan: 4, align: center + horizon)[#text(fill: muted, style: "italic")[wanting.];], [#box[#pform("הַקְטֵל", true);];], table.cell(rowspan: 4, align: center + horizon)[#text(fill: muted, style: "italic")[wanting.];], [#box[#pform("הִתְקַטֵּל", true);];], [], [2 #emph[f];], [#box[#pform("הַקְטִ֫ילִי", true);];], [#box[#pform("הִתְקַטְּלִי", true);];], [#emph[Plur.];], [2 #emph[m];], [#box[#pform("הַקְטִ֫ילוּ", false);];], [#box[#pform("הִתְקַטְּלוּ", false);];], [], [2 #emph[f];], [#box[#pform("הַקְטֵ֫לְנָה", true);];], [#box[#pform("הִתְקַטֵּ֫לְנָה", true);];], table.hline(stroke: 0.6pt + primary), [#emph[Impf. Sing.];], [3 #emph[m];], [#box[#pform("יְקֻטַּל", true);];], [#box[#pform("יַקְטִיל", true);];], [#box[#pform("יָקְטַל", true);];], [#box[#pform("יִתְקַטֵּל", true);];], [], [3 #emph[f];], [#box[#pform("תְּקֻטַּל", false);];], [#box[#pform("תַּקְטִיל", false);];], [#box[#pform("תָּקְטַל", false);];], [#box[#pform("תִּתְקַטֵּל", false);];], [], [2 #emph[m];], [#box[#pform("תְּקֻטַּל", false);];], [#box[#pform("תַּקְטִיל", false);];], [#box[#pform("תָּקְטַל", false);];], [#box[#pform("תִּתְקַטֵּל", false);];], [], [2 #emph[f];], [#box[#pform("תְּקֻטְּלִי", true);];], [#box[#pform("תַּקְטִ֫ילִי", true);];], [#box[#pform("תָּקְטְלִי", true);];], [#box[#pform("תִּתְקַטְּלִי", true);];], [], [1 #emph[c];], [#box[#pform("אֲקֻטַּל", false);];], [#box[#pform("אַקְטִיל", false);];], [#box[#pform("אָקְטַל", false);];], [#box[#pform("אֶתְקַטֵּל", false);];], [#emph[Plur.];], [3 #emph[m];], [#box[#pform("יְקֻטְּלוּ", false);];], [#box[#pform("יַקְטִ֫ילוּ", false);];], [#box[#pform("יָקְטְלוּ", false);];], [#box[#pform("יִתְקַטְּלוּ", false);];], [], [3 #emph[f];], [#box[#pform("תְּקֻטַּ֫לְנָה", true);];], [#box[#pform("תַּקְטֵ֫לְנָה", true);];], [#box[#pform("תָּקְטַ֫לְנָה", true);];], [#box[#pform("תִּתְקַטֵּ֫לְנָה", true);];], [], [2 #emph[m];], [#box[#pform("תְּקֻטְּלוּ", false);];], [#box[#pform("תַּקְטִ֫ילוּ", false);];], [#box[#pform("תָּקְטְלוּ", false);];], [#box[#pform("תִּתְקַטְּלוּ", false);];], [], [2 #emph[f];], [#box[#pform("תְּקֻטַּ֫לְנָה", false);];], [#box[#pform("תַּקְטֵ֫לְנָה", false);];], [#box[#pform("תָּקְטַ֫לְנָה", false);];], [#box[#pform("תִּתְקַטֵּ֫לְנָה", false);];], [], [1 #emph[c];], [#box[#pform("נְקֻטַּל", false);];], [#box[#pform("נַקְטִיל", false);];], [#box[#pform("נָקְטַל", false);];], [#box[#pform("נִתְקַטֵּל", false);];], table.hline(stroke: 0.6pt + primary), table.cell(colspan: 2)[#box[#emph[Shortened Impf. (Jussive)];]], [], [#box[#pform("יַקְטֵל", true);];], [], [], table.hline(stroke: 0.6pt + primary), [#emph[Part. act.];], [], [], [#box[#pform("מַקְטִיל", true);];], [], [#box[#pform("מִתְקַטֵּל", true);];], [#emph[Part. pass.];], [], [#box[#pform("מְקֻטָּל", true);];], [], [#box[#pform("מָקְטָל", true);];], [],));
