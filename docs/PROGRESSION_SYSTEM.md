# Progression & Rating tizimi — dizayn spetsifikatsiyasi (v1)

> **AI uchun yo'riqnoma:** Bu fayl o'yindagi persanaj darajasi (OVR), uning o'sishi, ligalar kuchi va NPC o'yinchilar generatsiyasi uchun **yagona manba (source of truth)**. Kod yozishda barcha raqamlarni 10-bo'limdagi `PROGRESSION_CONFIG` dan oling, kodga "qattiq" yozib qo'ymang. Biror qoida bu faylga zid bo'lsa — bu faylni ustun deb hisoblang va farqni foydalanuvchiga ayting.

---

## 1. Atamalar

| Atama | Ma'nosi |
|---|---|
| **Atribut** | 6 ta asosiy ko'rsatkich: `pace`, `shooting`, `passing`, `dribbling`, `defending`, `physical`. Har biri 1–100. |
| **OVR (Overall / umumiy level)** | Atributlarning pozitsiyaga qarab og'irlikli o'rtachasi. 1–100. Foydalanuvchi "level" deb ko'radigan raqam shu. |
| **XP** | O'yin va mashg'ulotlardan yig'iladigan tajriba. Atributlarni oshirishga sarflanadi. |
| **Tier (daraja)** | Liga darajasi: Akademiya → 2-liga → 1-liga → Elit. |
| **Mavsum** | ~30 ta o'yin + mashg'ulotlar. Balans "o'rtacha o'yinchi mavsumiga ~3000 XP" asosida hisoblangan. |

---

## 2. OVR qanday hisoblanadi

```
OVR = floor( Σ (atribut_i × og'irlik_i[pozitsiya]) )
```

Og'irliklar (har bir qatorda yig'indi = 1.00):

| Pozitsiya | pace | shooting | passing | dribbling | defending | physical |
|---|---|---|---|---|---|---|
| ST (hujumchi) | 0.20 | 0.30 | 0.10 | 0.20 | 0.05 | 0.15 |
| W (qanot) | 0.25 | 0.20 | 0.15 | 0.25 | 0.05 | 0.10 |
| CAM | 0.10 | 0.20 | 0.30 | 0.25 | 0.05 | 0.10 |
| CM | 0.10 | 0.10 | 0.30 | 0.20 | 0.15 | 0.15 |
| CDM | 0.10 | 0.05 | 0.20 | 0.10 | 0.30 | 0.25 |
| FB (qanot himoyachi) | 0.25 | 0.05 | 0.15 | 0.10 | 0.25 | 0.20 |
| CB | 0.10 | 0.00 | 0.10 | 0.05 | 0.40 | 0.35 |

- OVR har doim `floor` bilan yaxlitlanadi (99.9 → 99). Shuning uchun **100 OVR faqat asosiy atributlarning deyarli hammasi 100 bo'lganda** chiqadi — bu ataylab qilingan.
- GK (darvozabon) keyingi versiyada alohida atributlar bilan qo'shiladi.

---

## 3. Persanaj yaratish (start)

1. Har bir yangi persanajning barcha atributlari shunday qo'yiladiki, **OVR = 52** bo'ladi (pozitsiyaning asosiy atributlari ~55, ikkinchi darajalilari ~45–50).
2. Foydalanuvchiga **12 ta "Yaratish ochkosi" (Creation Points)** beriladi. 1 ochko = +1 atribut.
3. Cheklovlar:
   - Bitta atributga maksimum **+5** ochko.
   - Yaratishdan keyingi OVR **55 dan oshmasligi kerak** (`CREATION_MAX_OVR`). Agar ochko qo'shish OVR ni 56 ga chiqarsa — tugma bloklanadi.
   - Natija: ochkolarni asosiy atributlarga qo'ygan foydalanuvchi **54–55**, tarqatib yuborgan **53–54** bilan boshlaydi. Bu tanlovga ma'no beradi.
4. UI: OVR raqami ochko qo'shilganda jonli o'zgarib turadi (dopamin #1).

---

## 4. XP qayerdan keladi

### 4.1. O'yindan (asosiy manba)

```
matchXP = ( 60
          + max(-40, (matchRating - 6.0) × 40)
          + goals × 25 + assists × 20
          + (cleanSheet && pozitsiya himoyachi ? 30 : 0)
          + (MOTM ? 50 : 0)
          + (g'alaba ? 20 : durang ? 10 : 0)
          ) × (o'ynagan_daqiqa / 90)
            × leagueXpMult[tier]
            × opponentMod
            × overlevelMod
matchXP = max(matchXP, 15)   // har doim ozgina XP beriladi
```

- `matchRating` — o'yin dvigateli beradigan 1.0–10.0 baho (o'rtacha ~6.5).
- `opponentMod = clamp(1 + (raqib_jamoa_o'rtacha_OVR − persanaj_OVR) × 0.02, 0.8, 1.3)` — kuchliroq raqibga qarshi o'ynash ko'proq XP beradi.
- `overlevelMod` — 7-bo'limga qarang.

### 4.2. Mashg'ulotdan

- Kuniga **3 ta** mashg'ulot, har biri **30 XP** (× `leagueXpMult`).
- Mashg'ulot faqat XP beradi, OVR ga to'g'ridan to'g'ri ta'sir qilmaydi.

### 4.3. Kalibrlash maqsadi

O'rtacha o'yinchi (rating ~6.5) Akademiyada mavsumiga **~3000 XP** oladi. Yuqori ligalarda `leagueXpMult` tufayli bu oshadi. Yaxshi o'ynaydigan o'yinchi ~1.4× tezroq o'sadi.

---

## 5. XP qanday sarflanadi (atribut o'sishi)

- Foydalanuvchi XP ni o'zi tanlagan atributga sarflaydi: **+1 atribut** narxi atributning **hozirgi qiymatiga** bog'liq:

```
baseCost(v) = 200 × 1.065^(v − 52)
if v >= 85:  baseCost(v) ×= 1.13^(v − 84)     // 85 dan keyin "devor"
attrCost(v) = round( baseCost(v) × 0.3 / 10 ) × 10
```

- `0.3` koeffitsienti shundan: OVR ni +1 ga oshirish uchun taxminan 3–4 ta atribut ochkosi kerak bo'ladi, shuning uchun **OVR bir levelga oshish narxi ≈ `baseCost(OVR)`**.
- Qoidalar:
  - Atribut maksimumi **100**.
  - Atribut `OVR + 15` dan oshmaydi (bitta atributni 99 qilib, qolganini tashlab qo'yishning oldini oladi).
  - Asosiy (og'irligi yuqori) atributlarni oshirish OVR ni tezroq ko'taradi — bu strategik tanlov.

### 5.1. Kutilayotgan o'sish tezligi (o'rtacha o'yinchi uchun)

| OVR | +1 level narxi (XP) | Jami XP (52 dan) | Taxminiy mavsum |
|---|---|---|---|
| 55 | 230 | 640 | 0.2 |
| 60 | 310 | 2 010 | 0.7 |
| 65 | 430 | 3 900 | 1.2 |
| 70 | 580 | 6 470 | 1.9 |
| 75 | 800 | 10 000 | 2.7 |
| 80 | 1 100 | 14 860 | 3.7 |
| 85 | 1 500 | 21 500 | 4.9 |
| 90 | 3 790 | 35 040 | 7.1 |
| 95 | 9 560 | 69 190 | 12.8 |
| 99 | 20 050 | 131 260 | 23.2 |
| **100** | 24 130 | 155 390 | **27.2** |

**Hissiyot bo'yicha ma'nosi:**
- **52 → 65 (birinchi mavsum):** tez. Deyarli har 2–3 o'yinda level-up. Foydalanuvchi "o'syapman" deb his qiladi.
- **65 → 85 (2–5 mavsum):** barqaror, har level bir necha o'yin talab qiladi.
- **85 → 95:** sekin, maqsadli o'ynash kerak.
- **95 → 100:** juda qiyin, lekin imkonsiz emas. Faqat uzoq va jiddiy o'ynaganlar (yaxshi reytinglar bilan ~15–20 mavsum) yetadi.

---

## 6. OVR o'yinga qanday ta'sir qiladi

O'yin dvigatelida har bir harakat (dribling, pas, zarba, tortib olish) atributlar to'qnashuvi bilan hal qilinadi:

```
successChance = clamp( sigmoid( (hujumchi_atributi − himoyachi_atributi) / 10 ) , 0.05, 0.95 )
```

- Masalan: 70 dribling vs 60 defending → ~73% muvaffaqiyat. 70 vs 80 → ~27%.
- Shuning uchun level oshgani sari persanaj **o'z ligasida** ustun o'ynaydi, lekin yuqori ligaga o'tganda raqiblar ham kuchli bo'lgani uchun yana qiyinlashadi.
- `matchRating` muvaffaqiyatli/muvaffaqiyatsiz harakatlar, gol, assist va xatolardan hisoblanadi.

---

## 7. Ligalar (tier) va o'yinchilar kuchi

### 7.1. Tierlar

| Tier | Oddiy o'yinchilar | Yaxshi o'yinchilar | Kuchlilar / kapitanlar | `leagueXpMult` |
|---|---|---|---|---|
| **Akademiya** | 55–58 | 57–60 | 60–62 | 1.0 |
| **2-liga** | 60–65 | 64–69 | 68–72 | 1.3 |
| **1-liga** | 65–72 | 70–77 | 76–82 | 1.6 |
| **Elit** *(keyingi bosqich, 90+ ga ma'no berish uchun)* | 74–80 | 79–86 | 85–92 | 2.0 |

### 7.2. Jamoa tarkibini generatsiya qilish (har jamoa ~18 o'yinchi)

- **60%** — oddiy, **28%** — yaxshi, **12%** — kuchli (har jamoada 1–2 ta, kapitan albatta shu guruhdan).
- Diapazon ichida OVR **normal taqsimot** bilan tanlanadi (diapazon o'rtasi atrofida ko'proq).
- Ligadagi jamoalar o'zaro kuchi ham farq qiladi: kuchli jamoalar ±2 OVR yuqoriroq.
- NPC lar har mavsum oxirida −2…+3 OVR o'zgaradi (yoshlar o'sadi, keksalar tushadi), lekin tier diapazonidan chiqmaydi.

### 7.3. Ligaga ko'tarilish (promotion)

Persanajga yuqori ligadagi klubdan **taklif** keladi, agar:
- OVR ≥ keyingi tier "oddiy" minimumi + 2 (masalan, 2-liga uchun ≥ 62), **va**
- So'nggi 10 o'yindagi o'rtacha `matchRating` ≥ 6.8.

### 7.4. "O'z ligasidan o'sib ketish" jarimasi (`overlevelMod`)

Foydalanuvchini quyi ligada qolib, oson XP yig'ishdan to'xtatish uchun:
- OVR ≤ tier "kuchlilar" maksimumi → `overlevelMod = 1.0`
- Undan 1–3 yuqori → `0.75`
- Undan 4+ yuqori → `0.5`

---

## 8. Dopamin va his qilish (feedback)

- **Level-up animatsiyasi** har OVR oshganda (raqam "sakraydi", ovoz effekti).
- **Karta rangi** OVR ga qarab o'zgaradi:
  - < 65 — Bronza · 65–74 — Kumush · 75–84 — Oltin · 85–89 — Elit · 90–98 — Afsona · 99–100 — Ikona
- **Milestone mukofotlari:** 60, 65, 70, 75, 80, 85, 90, 95, 99, 100 da — nishon (badge), maxsus bayram/ekran, ijtimoiy tarmoqqa ulashish tugmasi.
- **Progress bar:** keyingi levelgacha qancha XP qolgani doim ko'rinadi.
- **Mavsum yakuni hisoboti:** "Mavsum boshida 58 edingiz → endi 66" (+8 OVR).
- **Taqqoslash:** ligadagi eng kuchli o'yinchi bilan farq ko'rsatiladi ("Kapitandan 3 OVR pastdasiz").

---

## 9. Muhim cheklovlar (o'zgarmas qoidalar)

1. XP ni pul bilan sotib olish **yo'q** (yoki faqat kosmetik narsalar) — progress halol bo'lishi kerak.
2. OVR hech qachon pasaymaydi (jarohat vaqtincha atributlarni tushirishi mumkin, lekin tiklanadi).
3. 100 OVR — faqat atributlar orqali, hech qanday "bonus" bilan emas.

---

## 10. Konfiguratsiya (kodda shu obyektdan foydalaning)

```ts
export const PROGRESSION_CONFIG = {
  START_OVR: 52,
  CREATION_POINTS: 12,
  CREATION_MAX_PER_ATTR: 5,
  CREATION_MAX_OVR: 55,
  MAX_ATTR: 100,
  MAX_ATTR_ABOVE_OVR: 15,

  COST: { base: 200, growth: 1.065, wallStart: 85, wallGrowth: 1.13, attrFactor: 0.3 },

  MATCH_XP: {
    base: 60, ratingPivot: 6.0, perRatingPoint: 40, minRatingBonus: -40,
    goal: 25, assist: 20, cleanSheet: 30, motm: 50, win: 20, draw: 10, minXP: 15,
    opponentModPerOvr: 0.02, opponentModMin: 0.8, opponentModMax: 1.3,
  },
  TRAINING: { sessionsPerDay: 3, xpPerSession: 30 },

  TIERS: {
    academy: { regular: [55, 58], good: [57, 60], strong: [60, 62], xpMult: 1.0 },
    league2: { regular: [60, 65], good: [64, 69], strong: [68, 72], xpMult: 1.3 },
    league1: { regular: [65, 72], good: [70, 77], strong: [76, 82], xpMult: 1.6 },
    elite:   { regular: [74, 80], good: [79, 86], strong: [85, 92], xpMult: 2.0 },
  },
  SQUAD_MIX: { regular: 0.60, good: 0.28, strong: 0.12 },

  PROMOTION: { ovrAboveNextRegularMin: 2, minAvgRatingLast10: 6.8 },
  OVERLEVEL: [ { above: 0, mod: 1.0 }, { above: 1, mod: 0.75 }, { above: 4, mod: 0.5 } ],

  CARD_TIERS: [
    { min: 0, name: "Bronza" }, { min: 65, name: "Kumush" }, { min: 75, name: "Oltin" },
    { min: 85, name: "Elit" }, { min: 90, name: "Afsona" }, { min: 99, name: "Ikona" },
  ],
  MILESTONES: [60, 65, 70, 75, 80, 85, 90, 95, 99, 100],
} as const;
```

---

## 11. Tekshiruv mezonlari (AI kodni yozgandan keyin shularni test qilsin)

- [ ] Yangi persanaj ochkolarsiz OVR = 52.
- [ ] 12 ochkoning hammasi asosiy atributlarga qo'yilsa ham OVR ≤ 55.
- [ ] `attrCost` 52 da ~60 XP, 85 da ~450 XP, 99 da ~6000 XP atrofida.
- [ ] Simulyatsiya: o'rtacha (rating 6.5) o'yinchi 1 mavsumda ~62–65 ga, 4 mavsumda ~80 ga yetadi.
- [ ] Akademiya jamoasida hech bir NPC 62 dan yuqori emas; har jamoada kamida 1 ta "kuchli" (kapitan) bor.
- [ ] Akademiyada OVR 66 bo'lgan persanaj o'yindan 0.5× XP oladi.
- [ ] OVR 99.9 bo'lsa ham ekranda 99 ko'rinadi.
