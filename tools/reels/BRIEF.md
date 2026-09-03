# Writing a NOOR reel

NOOR Codex of Light (noorcodex.com) is a free, non profit Islamic library. Its
daily "Light" cards are short, fact checked pieces of Islamic history, science
and heritage, written and audited in English. You are turning a batch of those
cards into scripts for twenty second vertical videos for Instagram and Facebook
Reels, where they will be shown mostly to people who do not follow the account
and many of whom are not Muslim.

The video is silent and wordless except for the type on screen. There is no
voice, no music, no photograph: the picture is generated Islamic geometry. So
the words carry everything.

## What you write, per card

A JSON object keyed by the card id, each value:

    eyebrow   the category, one or two words, small gold label   (max 22 chars)
    hook      the claim, the first thing on screen                (max 62 chars)
    key       an exact substring OF THE HOOK, the phrase that
              carries the surprise; it turns gold and underlines
              itself as it lands                                 (2 to 4 words)
    date      the dateline: who and when, or where and when      (max 46 chars)
    lines     exactly three sentences of substance               (max 118 chars each)
    caption   what goes under the post                           (see below)

## The rules

1. **Nothing may be invented.** Every fact, name, number, date, century and
   place must come from the card's own `s` text. If the card does not say it,
   it does not go in. This is the whole reason the account can be trusted, and
   a reel is screenshotted and argued with far more often than a web page.
2. **The hook is a claim, not a headline.** A full sentence a person could say
   out loud. "A little cloud in his star book was another galaxy", not "The
   Andromeda discovery". Prefer the card's own `t` if it fits the length; tighten
   it if it does not; never make it vaguer to make it shorter.
3. **`key` must appear in `hook` character for character**, including case and
   punctuation. Choose the words a reader would repeat to a friend. Not the
   first two words, not the whole hook.
4. **The three lines are a sequence, not a summary.** Line one sets the scene.
   Line two delivers the evidence, with the number or the name in it. Line three
   lands the consequence, and is the sentence a person screenshots. Each line
   must read on its own on a phone in about three seconds.
5. **Say Allah**, never God, when the source says Allah. "the Prophet ﷺ" with the
   honorific exactly as it appears. Keep Arabic script unchanged.
6. **No em dashes and no en dashes.** Commas, colons, full stops, or the middot ·
   which the house uses. No emoji anywhere in eyebrow, hook, date or lines.
7. **Numbers in Western digits**, exactly as the card writes them: 622, 1,000,
   14th century, 1543.
8. **Register:** clear, warm, precise, the voice of a very good museum label. Not
   academic, not preachy, not chatty, no hype, no "mind blowing", no rhetorical
   questions, no second person. A reader of fourteen should follow it and an
   adult should not find it thin.
9. **Never open a line with "And" or "But", and never end one with an ellipsis.**
   No cliffhanger bait. The claim is the hook; the reel keeps its promise.

## The caption

Two to four sentences, then the link, then the tags. It is read after the video,
by someone deciding whether to follow. It must add something the video did not
say, drawn from the same card, and it must never repeat the hook verbatim.

    <two to four sentences, at most 480 characters>

    Read the whole thing free at noorcodex.com

    <8 to 12 hashtags>

Tags: always include #NoorCodexOfLight and #Islam. Then tags a person actually
searches: the subject (#IslamicHistory #IslamicArt #Astronomy #History), the
place or century where it helps, and nothing spammy, nothing in all caps, no
tag that names a person, no more than twelve. Emoji are allowed in the caption
only, and at most one, and only if it is a crescent, a star, a book or a lamp.

## Finishing

Verify before you hand back:

    python3 -c "
    import json,sys
    a=json.load(open(IN)); b=json.load(open(OUT))
    assert set(a)==set(b), 'id mismatch'
    for k,v in b.items():
        assert set(v)>={'eyebrow','hook','key','date','lines','caption'}, k
        assert v['key'] in v['hook'], 'key not in hook: '+k
        assert len(v['lines'])==3, k
        assert len(v['eyebrow'])<=22 and len(v['hook'])<=62 and len(v['date'])<=46, k
        assert all(len(l)<=118 for l in v['lines']), k
        for f in ('eyebrow','hook','date','caption',*v['lines']):
            assert '—' not in f and '–' not in f, 'dash in '+k
    print('ok', len(b))"

Then one line: how many cards you wrote and anything you had to decide, at most
twenty words.
