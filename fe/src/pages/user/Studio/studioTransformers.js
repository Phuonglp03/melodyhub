const SECTION_LABELS = ["Intro", "A", "B", "C", "Ending"];
const SECTION_BAR_COUNT = 8;

export const DEFAULT_BAND_SETTINGS = {
  style: "Swing",
  volumes: { drums: 0.8, bass: 0.8, piano: 0.8 },
  mutes: { drums: false, bass: false, piano: false },
};

const createEmptySection = (label = "A", index = 0) => ({
  id: `section-${index}`,
  label,
  bars: Array(SECTION_BAR_COUNT).fill(""),
  licks: [],
});

const parseChordName = (entry, fallback = "") => {
  if (!entry) return fallback;
  if (typeof entry === "string") return entry;
  return (
    entry.chordName ||
    entry.chord ||
    entry.name ||
    entry.symbol ||
    fallback
  );
};

const padBars = (bars = []) => {
  const sanitized = (Array.isArray(bars) ? bars : [])
    .map((bar, idx) => parseChordName(bar, `Chord ${idx + 1}`))
    .map((bar) => (typeof bar === "string" ? bar : ""));

  if (sanitized.length >= SECTION_BAR_COUNT) {
    return sanitized.slice(0, SECTION_BAR_COUNT);
  }

  return [
    ...sanitized,
    ...Array(SECTION_BAR_COUNT - sanitized.length).fill(""),
  ];
};

const sanitizeSections = (sections = []) =>
  (Array.isArray(sections) ? sections : [])
    .map((section, index) => ({
      id: section?.id || `section-${index}`,
      label:
        section?.label ||
        SECTION_LABELS[Math.min(index, SECTION_LABELS.length - 1)] ||
        "A",
      bars: padBars(section?.bars),
      licks: Array.isArray(section?.licks) ? section.licks : [],
    }))
    .filter((section) => section.bars.length);

export const convertChordProgressionToSections = (progression = []) => {
  if (!Array.isArray(progression) || !progression.length) {
    return [];
  }

  const chordNames = progression.map((entry, idx) =>
    parseChordName(entry, `Chord ${idx + 1}`)
  );

  const sections = [];
  for (let start = 0; start < chordNames.length; start += SECTION_BAR_COUNT) {
    const label =
      SECTION_LABELS[Math.min(sections.length, SECTION_LABELS.length - 1)] ||
      "A";
    const chunk = chordNames.slice(start, start + SECTION_BAR_COUNT);
    sections.push({
      id: `section-${sections.length}`,
      label,
      bars: padBars(chunk),
      licks: [],
    });
  }

  return sections;
};

const parseProjectKey = (key) => {
  if (!key) return "C";

  if (typeof key === "string") {
    const trimmed = key.trim();
    if (!trimmed) return "C";

    if (/minor/i.test(trimmed)) {
      const root = trimmed.split(/\s+/)[0];
      return `${root}m`;
    }

    if (/major/i.test(trimmed)) {
      return trimmed.split(/\s+/)[0];
    }

    if (/[A-G](#|b)?m$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }

    return trimmed;
  }

  if (typeof key === "object") {
    const root = key.root || key.note || "C";
    const scale = (key.scale || key.mode || "major").toLowerCase();
    return scale.startsWith("min") ? `${root}m` : root;
  }

  return "C";
};

const deriveStyle = (project = {}) =>
  project.style ||
  project.genre ||
  project.bandSettings?.style ||
  "Swing";

export const convertProjectToStudioState = (project) => {
  if (!project) return null;

  const sanitizedSections = sanitizeSections(project.sections);
  const sections = sanitizedSections.length
    ? sanitizedSections
    : convertChordProgressionToSections(project.chordProgression || []);

  return {
    key: parseProjectKey(project.key),
    bpm: project.tempo || project.bpm || 120,
    style: deriveStyle(project),
    sections: sections.length ? sections : [createEmptySection()],
    bandSettings: project.bandSettings || DEFAULT_BAND_SETTINGS,
    projectTitle: project.title || project.name || "",
  };
};

