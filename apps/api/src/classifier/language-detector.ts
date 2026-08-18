export type DetectedLanguage = "ENGLISH" | "NON_ENGLISH" | "UNKNOWN";

export interface LanguageDetectionResult {
  language: DetectedLanguage;
  confidence: number;
  sampleMatchedWords: string[];
}

const COMMON_ENGLISH_WORDS = new Set([
  "the", "and", "to", "of", "a", "in", "is", "that", "for", "it", "as",
  "was", "with", "be", "this", "have", "from", "or", "one", "by", "word",
  "but", "not", "what", "all", "were", "we", "when", "your", "can", "said",
  "there", "use", "an", "each", "which", "she", "do", "how", "their", "if",
  "will", "up", "other", "about", "out", "many", "then", "them", "these", "so",
  "some", "her", "would", "make", "like", "him", "into", "time", "has", "look",
  "two", "more", "write", "go", "see", "number", "no", "way", "could", "people",
  "my", "than", "first", "water", "been", "call", "who", "oil", "its", "now",
  "find", "long", "down", "day", "did", "get", "come", "made", "may", "part",
  "experience", "skills", "requirements", "responsibilities", "team", "work"
]);

const COMMON_NON_ENGLISH_MARKERS = [
  // Spanish / Portuguese
  /\b(requisitos|experiencia|años|responsabilidades|descripción|equipo|trabajo|qualificações|conhecimento|anos|descrição)\b/i,
  // French
  /\b(exigences|expérience|années|responsabilités|poste|profil|candidature)\b/i,
  // German
  /\b(anforderungen|erfahrung|jahre|verantwortung|qualifikationen|kenntnisse|stellenbeschreibung)\b/i,
  // Dutch
  /\b(vereisten|ervaring|jaren|verantwoordelijkheden|functieomschrijving)\b/i,
  // Italian
  /\b(requisiti|esperienza|anni|responsabilità|candidato)\b/i,
];

export class LanguageDetector {
  static detect(text: string): LanguageDetectionResult {
    if (!text || text.trim().length < 20) {
      return { language: "ENGLISH", confidence: 0.5, sampleMatchedWords: [] };
    }

    const cleanText = text.toLowerCase().replace(/[^a-zñáéíóúüäößàèìòùâêîôûç\s]/gi, " ");
    const words = cleanText.split(/\s+/).filter(w => w.length >= 2);

    if (words.length === 0) {
      return { language: "UNKNOWN", confidence: 0, sampleMatchedWords: [] };
    }

    // Check for explicit foreign language marker patterns
    const nonEnglishMatches: string[] = [];
    for (const pattern of COMMON_NON_ENGLISH_MARKERS) {
      const match = text.match(pattern);
      if (match) {
        nonEnglishMatches.push(match[0]);
      }
    }

    let englishWordCount = 0;
    const sampleEnglishWords: string[] = [];

    for (const word of words) {
      if (COMMON_ENGLISH_WORDS.has(word)) {
        englishWordCount++;
        if (sampleEnglishWords.length < 5) {
          sampleEnglishWords.push(word);
        }
      }
    }

    const englishRatio = englishWordCount / Math.min(words.length, 100);

    if (nonEnglishMatches.length >= 2 || (nonEnglishMatches.length >= 1 && englishRatio < 0.30)) {
      return {
        language: "NON_ENGLISH",
        confidence: 0.9,
        sampleMatchedWords: nonEnglishMatches.slice(0, 5)
      };
    }

    if (englishRatio >= 0.15 || (words.length < 30 && nonEnglishMatches.length === 0)) {
      return {
        language: "ENGLISH",
        confidence: Math.min(1.0, englishRatio * 4),
        sampleMatchedWords: sampleEnglishWords
      };
    }

    if (nonEnglishMatches.length > 0) {
      return {
        language: "NON_ENGLISH",
        confidence: 0.75,
        sampleMatchedWords: nonEnglishMatches
      };
    }

    return {
      language: "UNKNOWN",
      confidence: 0.3,
      sampleMatchedWords: []
    };
  }
}
