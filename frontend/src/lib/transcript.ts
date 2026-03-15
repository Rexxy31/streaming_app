export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

export function formatTimestamp(seconds: number) {
  if (Number.isNaN(seconds)) return "00:00";
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function parseTimestamp(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length !== 3) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);

  if ([hours, minutes, seconds].some((part) => Number.isNaN(part))) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseSubtitleText(subtitleText: string | null): SubtitleCue[] {
  if (!subtitleText) return [];

  return subtitleText
    .replace(/\r/g, "")
    .replace(/^WEBVTT\s*/i, "")
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2) return null;

      const timingLineIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingLineIndex === -1) return null;

      const [startText, endText] = lines[timingLineIndex].split("-->").map((part) => part.trim().split(/\s+/)[0]);
      const start = parseTimestamp(startText);
      const end = parseTimestamp(endText);
      if (start === null || end === null) return null;

      const text = lines
        .slice(timingLineIndex + 1)
        .join("\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (!text) return null;

      return { start, end, text };
    })
    .filter((cue): cue is SubtitleCue => cue !== null);
}

export function normalizeCueText(text: string) {
  return text
    .replace(/-\s*\n\s*/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
