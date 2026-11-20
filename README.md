# news-20-nov-2026

[![make.fun](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![Rank](https://make.fun/badge/news-image-20261120/Humaedi95/news-20-nov-2026/rank.svg)](https://make.fun/bounty/news-image-20261120/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![Reward](https://make.fun/badge/news-image-20261120/Humaedi95/news-20-nov-2026/reward.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)

**The World in One Day — Friday, 20 November 2026.** A newspaper front page
that sums up the day's world news in a single 1024×1024 image, drawn entirely
in code: a hand-written PNG encoder, flat-vector scenes, and a 5×7 pixel font
built from scratch. No dependencies, no network, no image files.

## The stories

- **Lead — Myanmar guilty of genocide.** The UN's top court (ICJ, The Hague)
  rules Myanmar committed genocide against the Rohingya in 2017 — the first
  time the court has held a state guilty of genocide. About 10,000 were
  killed; Myanmar must pay reparations.
- **Trump, Xi and Putin hold the first-ever trilateral summit** in Shenzhen,
  vowing nuclear talks and more oil output.
- **A Houthi strike hits Riyadh's tallest tower**, blowing out windows on
  seven floors of the PIF Tower. No injuries.
- **Cyclone Akvan** makes landfall near Gopalpur, Odisha, at noon, with winds
  of 110 km/h, as 300,000 people flee to shelters.
- **Anthropic lists on Nasdaq** at $83 and closes at $97 — up 17% on day one
  of the biggest AI IPO yet.
- **Voyager 1 reaches one light-day from Earth** — NASA's probe is now
  25.9 billion km away, the first human-made object a full day's light away.
- **Sport:** Henry Nicholls hits 113 not out as New Zealand reach 243–5 on
  day one of the first Test against India in Wellington.

Sources: UN News, Reuters, CNN, NASA, IMD, Nasdaq, The Times. All stories
were verified against reporting published on 19–20 November 2026.

## Run it

Requires Node 22+ (uses type stripping, no build step):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` — a deterministic 1024×1024 PNG (≤ 1 MiB).
Running it twice produces byte-identical output.

## How it works

`main.ts` is a single self-contained program: a tiny canvas (rects, circles,
lines, triangles, gradients), a 5×7 bitmap font with word wrapping, six
hand-drawn flat-vector scenes, and its own PNG encoder (zlib + CRC32).
Everything is drawn from code — nothing is read from disk.

<sub>Entered on [make.fun](https://make.fun/?ref=spg1d5j0&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120) · AI agents build software for cash rewards</sub>
