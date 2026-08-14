NOOR Codex of Light · the source and the pipeline, at v69

WHAT THIS IS, AND WHY YOU HAVE IT

The deploy zip contains the website: the pages a reader loads. This contains the
things those pages are BUILT FROM, which the website does not need and a future
session cannot work without. It lives only in the cloud workspace otherwise, and
that workspace does not last forever. Keep this somewhere you will find it.

  scripts/     the generators. Every room that is generated rather than hand
               written comes from one of these, and editing the page directly
               is a mistake because the next build overwrites it.

     nav49.py            the header, the menu and the 21 language doors.
                         Run it after changing any of them. It is idempotent.
     room.py             the shared page frame every generated room uses
     gen-dictionary.py   builds /dictionary from build/dict-*.json
     gen-protection.py   builds /protection from build/protection.json
     gen-hajj*.py, gen-family.py, gen-heroes.py, gen-ramadan.py, gen-eid.py,
     gen-stories.py, gen-sermon-soul.py, gen-unseen.py, gen-quran-study.py
     i18n.py             translation status, queue and merge. See below.
     extract-text.py     harvests translatable strings from the HTML
     harvest-dom.mjs     harvests them from the RENDERED pages instead, which
                         is the one that matters, because it sees the text the
                         pages build with JavaScript
     make-batches.py     cuts the corpus into batches, highest reach first
     logical-css.py      rewrites physical CSS into logical CSS so the site
                         reads correctly right to left. Safe to re-run.

  build/       the content, as data. The dictionary's 523 entries are seven
               dict-*.json files; the Protection room is protection.json. This
               is where to correct a definition, not in the built HTML.

  i18n/        the language packs. i18n/*.json are the menu and chrome.
               i18n/text/en.json is the corpus, 10,439 strings and 165,505
               words, and it is what the queue measures against.

THE TRANSLATION QUEUE

  python3 scripts/i18n.py status        coverage of all 21, measured honestly
  python3 scripts/i18n.py todo <code>   the next untranslated strings only
  python3 scripts/i18n.py merge <code>  fold finished parts into the pack

Nothing already carried is carried twice: the queue is keyed on the string
itself, so it resumes wherever it stopped, in this session or a later one.

ORDER OF OPERATIONS AFTER EDITING CONTENT

  1. edit build/<something>.json
  2. python3 scripts/gen-<that room>.py
  3. python3 scripts/nav49.py           if you touched the menu
  4. python3 scripts/logical-css.py     if you added CSS
  5. deploy the changed files

WHAT IS NOT HERE

The git history. 96 commits sit in the cloud workspace and cannot be pushed:
the git proxy refuses credentials for Eouchi147/noor because the repository is
not in the session's authorised set. Adding it there would let a future session
push directly instead of building zips.
