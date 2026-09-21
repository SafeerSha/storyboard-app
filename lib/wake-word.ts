// Wake Word Detection & Resilient Phonetic Matcher for Reqly
// Matches "Reqly", "Hey Reqly", its most common phonetic engine transcriptions,
// and universal voice assistant phrases ("Hey Assistant", "Hey StoryBoard").
// Explicitly avoids common English words like "really", "directly", "ready", "request" unless preceded by "hey/ok".

const STRICT_WAKE_WORDS = [
  "reqly",
  "reckly",
  "reckley",
  "recly",
  "regly",
  "radley",
  "riley",
  "wreckly",
  "assistant",
  "storyboard",
];

// Words that may sound like "reqly" only when preceded by a conversational salutation (hey, ok, hi, hello)
const SALUTATION_PREFIXED_WAKE_WORDS = [
  "rely",
  "reply",
  "really",
  "ready",
  "ricky",
  "reggie",
  "relay",
  "weekly",
  "gemini",
];

const STRICT_REGEX = new RegExp(
  `\\b(?:hey|hi|hello|ok|okay)?\\s*(${STRICT_WAKE_WORDS.join("|")})\\b`,
  "i"
);

const PREFIXED_REGEX = new RegExp(
  `\\b(?:hey|hi|hello|ok|okay)\\s+(${SALUTATION_PREFIXED_WAKE_WORDS.join("|")})\\b`,
  "i"
);

export function matchWakeWord(transcript: string): {
  matched: boolean;
  wakeWordMatched?: string;
  remainder: string;
} {
  if (!transcript) return { matched: false, remainder: "" };

  const clean = transcript.trim().toLowerCase();
  const words = clean.split(/\s+/);

  // 1. Isolated 1-2 word utterance check:
  // When a user says just "Reqly" or "Hey Reqly", speech engines frequently transcribe it as "rely", "reply", "really", "ready".
  // Because it's isolated (not a sentence like "I really think"), it is reliably the wake word!
  if (words.length <= 2) {
    const firstWord = words[0].replace(/[^a-z]/g, "");
    const lastWord = words[words.length - 1].replace(/[^a-z]/g, "");
    const allCandidates = [...STRICT_WAKE_WORDS, ...SALUTATION_PREFIXED_WAKE_WORDS];
    if (allCandidates.includes(lastWord) || allCandidates.includes(firstWord)) {
      return {
        matched: true,
        wakeWordMatched: lastWord || firstWord,
        remainder: "",
      };
    }
  }

  // 2. Strict wake word pattern (e.g., "reqly", "hey reqly", "assistant", "hey assistant")
  const strictMatch = clean.match(STRICT_REGEX);
  if (strictMatch && strictMatch.index !== undefined) {
    const remainder = clean.slice(strictMatch.index + strictMatch[0].length).trim();
    return {
      matched: true,
      wakeWordMatched: strictMatch[1],
      remainder,
    };
  }

  // 3. Prefixed salutation pattern (e.g., "hey rely", "ok reply" - prevents bare "really" or "directly" in long sentences)
  const prefixedMatch = clean.match(PREFIXED_REGEX);
  if (prefixedMatch && prefixedMatch.index !== undefined) {
    const remainder = clean.slice(prefixedMatch.index + prefixedMatch[0].length).trim();
    return {
      matched: true,
      wakeWordMatched: prefixedMatch[1],
      remainder,
    };
  }

  // 4. Exact word match for "reqly" variations in longer sentences
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[^a-z]/g, "");
    if (w === "reqly" || w === "reckly" || w === "recly" || w === "regly") {
      const remainder = words.slice(i + 1).join(" ").trim();
      return {
        matched: true,
        wakeWordMatched: w,
        remainder,
      };
    }
  }

  return { matched: false, remainder: "" };
}
