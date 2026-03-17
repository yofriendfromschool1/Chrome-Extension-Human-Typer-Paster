/**
 * HumanTyper — Core Typing Engine
 * Ported from the Python CLI version.
 * Handles: tokenization, burst grouping, WPM timing, synonym lookup,
 * fatigue, hesitations, error simulation.
 */

/* ─── QWERTY Neighbor Map ─────────────────────────────── */
const NEARBY_KEYS = {
  a: 'sqwz',  b: 'vghn', c: 'xdfv', d: 'sfecx',
  e: 'wrsdf', f: 'dgrtcv', g: 'fhtyb', h: 'gjybn',
  i: 'uojk',  j: 'hkunm', k: 'jloi', l: 'kop',
  m: 'njk',   n: 'bhjm',  o: 'iplk', p: 'ol',
  q: 'wa',    r: 'edft',  s: 'awedxz', t: 'rfgy',
  u: 'yihj',  v: 'cfgb',  w: 'qase', x: 'zsdc',
  y: 'tghu',  z: 'asx',
};

/* ─── Helpers ─────────────────────────────────────────── */

function randUniform(a, b) {
  return a + Math.random() * (b - a);
}

function randInt(a, b) {
  return Math.floor(randUniform(a, b + 1));
}

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ─── Tokenizer ───────────────────────────────────────── */

function tokenizeText(text) {
  const tokens = [];
  const re = /[a-zA-Z']+|[^a-zA-Z']+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const content = m[0];
    tokens.push({
      type: content[0].match(/[a-zA-Z]/) ? 'word' : 'other',
      content,
    });
  }
  return tokens;
}

/* ─── Burst Grouping ──────────────────────────────────── */

function createBursts(tokens, burstSize) {
  const bursts = [];
  let current = [];
  let wc = 0;
  for (const tok of tokens) {
    current.push(tok);
    if (tok.type === 'word') {
      wc++;
      if (wc >= burstSize) {
        bursts.push(current);
        current = [];
        wc = 0;
      }
    }
  }
  if (current.length) bursts.push(current);
  return bursts;
}

/* ─── Synonym Lookup ──────────────────────────────────── */

function getSynonym(word, complexity) {
  const lookup = word.toLowerCase().replace(/'/g, '');
  const candidates = SYNONYMS[lookup];
  if (!candidates) return null;

  let pool;
  if (complexity === 'simple') {
    const filtered = candidates.filter(w => w.length <= lookup.length);
    pool = filtered.length ? filtered : candidates;
  } else if (complexity === 'complex') {
    const filtered = candidates.filter(w => w.length >= lookup.length);
    pool = filtered.length ? filtered : candidates;
  } else {
    pool = candidates;
  }

  let chosen = randChoice(pool);

  // Preserve capitalization
  if (word === word.toUpperCase() && word.length > 1) {
    chosen = chosen.toUpperCase();
  } else if (word[0] === word[0].toUpperCase()) {
    chosen = chosen[0].toUpperCase() + chosen.slice(1);
  }
  return chosen;
}

/* ─── Typo Generation ─────────────────────────────────── */

function getTypoChar(original) {
  const lower = original.toLowerCase();
  if (NEARBY_KEYS[lower]) {
    const neighbors = NEARBY_KEYS[lower];
    const typo = neighbors[Math.floor(Math.random() * neighbors.length)];
    return original === original.toUpperCase() ? typo.toUpperCase() : typo;
  }
  return original;
}

/* ─── WPM Target Timestamps ──────────────────────────── */

function computeTargetTimes(text, wpm) {
  if (!text) return [];
  const totalChars = text.length;
  const totalTime = (totalChars / 5.0) * (60.0 / wpm) * 1000; // ms

  const weights = [];
  for (let i = 0; i < totalChars; i++) {
    const prev = i > 0 ? text[i - 1] : '';
    let w;
    if ('.!?'.includes(prev)) w = randUniform(4, 8);
    else if (prev === ',') w = randUniform(2, 4);
    else if (prev === '\n') w = randUniform(3, 5);
    else if (prev === ' ') w = randUniform(1, 1.3);
    else w = 1.0;
    weights.push(w);
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const rawGaps = weights.map(w => (w / totalWeight) * totalTime);

  // Jitter ±30%, rescale
  const jittered = rawGaps.map(g => g * randUniform(0.7, 1.3));
  const jSum = jittered.reduce((a, b) => a + b, 0);
  const gaps = jSum > 0 ? jittered.map(g => g * (totalTime / jSum)) : rawGaps;

  const targets = [];
  let cum = 0;
  for (const g of gaps) {
    cum += g;
    targets.push(cum);
  }
  return targets;
}

/* ─── Sentence Start Detection ────────────────────────── */

function isSentenceStart(tokens, tokIdx) {
  for (let i = tokIdx - 1; i >= 0; i--) {
    if (tokens[i].type === 'other') {
      if (/[.!?]/.test(tokens[i].content)) return true;
      if (tokens[i].content.includes('\n')) return true;
    } else {
      return false;
    }
  }
  return tokIdx === 0;
}

/* ─── Main Typing Engine ─────────────────────────────── */

// eslint-disable-next-line no-unused-vars
async function runTyper(text, config, typeCharFn, typeBackspaceFn, onProgress, shouldStop) {
  const tokens = tokenizeText(text);
  const bursts = config.burstEnabled
    ? createBursts(tokens, config.burstWords)
    : [tokens];

  const totalChars = text.length;
  let charsTyped = 0;
  let errorsCount = 0;
  let subsCount = 0;
  let globalWordCount = 0;
  let rereadCounter = 0;
  let rereadThreshold = randInt(15, 40);
  let sentenceWordIdx = 0;

  // Flatten token index mapping
  let flatTokIdx = 0;

  for (let bIdx = 0; bIdx < bursts.length; bIdx++) {
    if (shouldStop()) break;

    const burst = bursts[bIdx];
    const burstText = burst.map(t => t.content).join('');
    const progress = totalChars > 0 ? charsTyped / totalChars : 0;
    const effectiveWpm = Math.max(10, config.wpm * (1 - config.fatigueRate * progress));

    const targets = computeTargetTimes(burstText, effectiveWpm);
    const burstStart = performance.now();
    let charOffset = 0;

    for (let tIdx = 0; tIdx < burst.length; tIdx++) {
      if (shouldStop()) break;
      const tok = burst[tIdx];
      const globalTokIdx = flatTokIdx + tIdx;

      if (tok.type === 'word') {
        globalWordCount++;
        rereadCounter++;
        sentenceWordIdx++;

        if (isSentenceStart(tokens, globalTokIdx)) sentenceWordIdx = 1;

        // Micro-hesitation before long words
        if (config.hesitationEnabled && tok.content.length >= 8) {
          await sleep(randUniform(100, 500));
        }

        // Word substitution check
        const shouldSub = config.substituteEnabled
          && Math.random() < config.substituteRate
          && tok.content.length >= 3
          && /^[a-zA-Z]+$/.test(tok.content);

        const synonym = shouldSub ? getSynonym(tok.content, config.substituteComplexity) : null;

        if (synonym && synonym.toLowerCase() !== tok.content.toLowerCase()) {
          subsCount++;

          // Type synonym quickly
          for (const c of synonym) {
            if (shouldStop()) break;
            await typeCharFn(c);
            await sleep(randUniform(30, 90));
          }

          // Pause — noticing wrong word
          await sleep(randUniform(400, 1800));

          // Backspace synonym
          await typeBackspaceFn(synonym.length);
          await sleep(randUniform(100, 400));

          // Retype correct word on-timeline
          for (const c of tok.content) {
            if (shouldStop()) break;
            if (charOffset < targets.length) {
              const wait = targets[charOffset] - (performance.now() - burstStart);
              if (wait > 0) await sleep(wait);
            }
            await typeCharFn(c);
            charsTyped++;
            charOffset++;
          }
        } else {
          // Normal word typing
          const slowFactor = sentenceWordIdx <= 2 ? randUniform(1.15, 1.30) : 1.0;

          for (let ci = 0; ci < tok.content.length; ci++) {
            if (shouldStop()) break;
            const c = tok.content[ci];

            if (charOffset < targets.length) {
              const wait = targets[charOffset] - (performance.now() - burstStart);
              if (wait > 0) await sleep(wait * slowFactor);
            }

            // Error simulation
            const shouldError = Math.random() < config.errorRate
              && /[a-zA-Z]/.test(c)
              && ci > 0 && ci < tok.content.length - 1;

            if (shouldError) {
              const errType = Math.random() < 0.7 ? 'wrong' : 'double';

              if (errType === 'wrong') {
                const wrong = getTypoChar(c);
                if (wrong !== c) {
                  errorsCount++;
                  await typeCharFn(wrong);
                  await sleep(randUniform(150, 500));

                  if (Math.random() < 0.3 && ci + 1 < tok.content.length) {
                    await typeCharFn(tok.content[ci + 1]);
                    await sleep(randUniform(200, 600));
                    await typeBackspaceFn(2);
                  } else {
                    await typeBackspaceFn(1);
                  }
                  await sleep(randUniform(50, 150));
                  await typeCharFn(c);
                } else {
                  await typeCharFn(c);
                }
              } else {
                errorsCount++;
                await typeCharFn(c);
                await typeCharFn(c);
                await sleep(randUniform(150, 450));
                await typeBackspaceFn(1);
              }
            } else {
              await typeCharFn(c);
            }

            charsTyped++;
            charOffset++;
          }
        }

        // Re-reading pause
        if (config.rereadingEnabled && rereadCounter >= rereadThreshold) {
          rereadCounter = 0;
          rereadThreshold = randInt(15, 40);
          await sleep(randUniform(
            (config.rereadingPauseMin || 0.5) * 1000,
            (config.rereadingPauseMax || 2.0) * 1000
          ));
        }

      } else {
        // Non-word tokens
        for (const c of tok.content) {
          if (shouldStop()) break;
          if (charOffset < targets.length) {
            const wait = targets[charOffset] - (performance.now() - burstStart);
            if (wait > 0) await sleep(wait);
          }
          await typeCharFn(c);
          charsTyped++;
          charOffset++;
        }

        // Paragraph pause
        if (tok.content.includes('\n\n')) {
          await sleep(randUniform(
            config.paragraphPauseMin * 1000,
            config.paragraphPauseMax * 1000
          ));
        }

        if (/[.!?]/.test(tok.content)) sentenceWordIdx = 0;
      }

      // Progress callback
      if (onProgress) {
        onProgress({
          charsTyped,
          totalChars,
          errorsCount,
          subsCount,
          progress: totalChars > 0 ? charsTyped / totalChars : 1,
        });
      }
    }

    flatTokIdx += burst.length;

    // Burst pause
    if (config.burstEnabled && bIdx < bursts.length - 1) {
      await sleep(randUniform(config.burstPauseMin * 1000, config.burstPauseMax * 1000));
    }
  }

  return { charsTyped, errorsCount, subsCount };
}
