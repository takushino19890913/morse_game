import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./src/components/ui/card.jsx";
import { Button } from "./src/components/ui/button.jsx";
import { Slider } from "./src/components/ui/slider.jsx";
import { Badge } from "./src/components/ui/badge.jsx";
import { Textarea } from "./src/components/ui/textarea.jsx";
import {
  buildScoreState,
  canEndPlayerPress,
  canStartPlayerPress,
  getRenderedNoteRect,
  judgeSingleNote,
} from "./src/lib/gameTiming.js";
import { Play, Square, Target, RotateCcw, Lightbulb } from "lucide-react";

const WABUN = {
  "あ": "－－・－－", "い": "・－", "う": "・・－", "え": "－・－－－", "お": "・－・・・",
  "か": "・－・・", "き": "－・－・・", "く": "・・・－", "け": "－・－－", "こ": "－－－－",
  "さ": "－・－・－", "し": "－－・－・", "す": "－－－・－", "せ": "・－－－・", "そ": "－－－・",
  "た": "－・", "ち": "・・－・", "つ": "・－－・", "て": "・－・－－", "と": "・・－・・",
  "な": "・－・", "に": "－・－・", "ぬ": "・・・・", "ね": "－－・－", "の": "・・－－",
  "は": "－・・・", "ひ": "－－・・－", "ふ": "－－・・", "へ": "・", "ほ": "－・・",
  "ま": "－・・－", "み": "・・－・－", "む": "－", "め": "－・・・－", "も": "－・・－・",
  "や": "・－－", "ゆ": "－・・－－", "よ": "－－",
  "ら": "・・・", "り": "－－・", "る": "－・－－・", "れ": "－－－", "ろ": "・－・－",
  "わ": "－・－", "ゐ": "・－・・－", "ゑ": "・－－・・", "を": "・－－－", "ん": "・－・－・",
  "゛": "・・", "゜": "・・－－・", "ー": "・－－・－", "、": "・－・－・－", "。": "・－・－・－",
  "？": "・・－－・・", "！": "－－・・－－", " ": " ", "　": " ",
};

const DAKUTEN_MAP = {
  "が": ["か", "゛"], "ぎ": ["き", "゛"], "ぐ": ["く", "゛"], "げ": ["け", "゛"], "ご": ["こ", "゛"],
  "ざ": ["さ", "゛"], "じ": ["し", "゛"], "ず": ["す", "゛"], "ぜ": ["せ", "゛"], "ぞ": ["そ", "゛"],
  "だ": ["た", "゛"], "ぢ": ["ち", "゛"], "づ": ["つ", "゛"], "で": ["て", "゛"], "ど": ["と", "゛"],
  "ば": ["は", "゛"], "び": ["ひ", "゛"], "ぶ": ["ふ", "゛"], "べ": ["へ", "゛"], "ぼ": ["ほ", "゛"],
  "ぱ": ["は", "゜"], "ぴ": ["ひ", "゜"], "ぷ": ["ふ", "゜"], "ぺ": ["へ", "゜"], "ぽ": ["ほ", "゜"],
  "ゔ": ["う", "゛"],
};

const SMALL_KANA_MAP = {
  "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お",
  "ゃ": "や", "ゅ": "ゆ", "ょ": "よ", "っ": "つ", "ゎ": "わ",
};

const SAMPLE_TEXTS = ["こんにちは", "おはよう", "しずかせんせい", "たすけて"];
const SYMBOL_GAP_UNITS = 1;
const PART_GAP_UNITS = 3;
const CHAR_GAP_UNITS = 4;
const WORD_GAP_UNITS = CHAR_GAP_UNITS;

const WABUN_REVERSE = Object.fromEntries(
  Object.entries(WABUN).filter(([, code]) => code !== " ").map(([char, code]) => [code, char])
);
const COMPOSED_FROM_PAIR = Object.fromEntries(
  Object.entries(DAKUTEN_MAP).map(([composed, parts]) => [parts.join(""), composed])
);
const BUILDER_CANDIDATES = Object.entries(WABUN).filter(([char, code]) => code && code !== " " && char !== "　");

function katakanaToHiragana(text) {
  return text.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function normalizeText(text) {
  return katakanaToHiragana(text).split("").map((char) => SMALL_KANA_MAP[char] || char).join("");
}

function encodeChar(char) {
  if (DAKUTEN_MAP[char]) return DAKUTEN_MAP[char].map((part) => ({ char: part, code: WABUN[part] || null }));
  return [{ char, code: WABUN[char] || null }];
}

function encodeText(text) {
  const normalized = normalizeText(text);
  const groups = [];
  for (const char of normalized) {
    if (char === " " || char === "　") {
      groups.push({ type: "word-gap" });
      continue;
    }
    groups.push({ type: "char-group", originalChar: char, parts: encodeChar(char) });
  }
  return { normalized, groups };
}

function buildRhythmData(groups, unitMs) {
  const notes = [];
  const rows = [];
  let currentMs = 0;
  let noteId = 0;

  groups.forEach((group, groupIndex) => {
    if (group.type === "word-gap") {
      currentMs += unitMs * WORD_GAP_UNITS;
      return;
    }

    const rowStart = currentMs;

    group.parts.forEach((part, partIndex) => {
      const symbols = (part.code || "").split("");
      symbols.forEach((symbol, symbolIndex) => {
        const duration = symbol === "・" ? unitMs : unitMs * 3;
        notes.push({
          id: noteId,
          kind: symbol === "・" ? "dot" : "dash",
          symbol,
          start: currentMs,
          end: currentMs + duration,
          duration,
          charLabel: group.originalChar,
          code: part.code,
        });
        noteId += 1;
        currentMs += duration;
        if (symbolIndex < symbols.length - 1) currentMs += unitMs * SYMBOL_GAP_UNITS;
      });
      if (partIndex < group.parts.length - 1) currentMs += unitMs * PART_GAP_UNITS;
    });

    const nextGroup = groups[groupIndex + 1];
    if (nextGroup && nextGroup.type !== "word-gap") currentMs += unitMs * CHAR_GAP_UNITS;

    rows.push({
      char: group.originalChar,
      start: rowStart,
      end: currentMs,
      code: group.parts.map((part) => part.code || "?").join(" / "),
    });
  });

  return { notes, rows, totalMs: currentMs };
}

function composeRawEntries(entries) {
  let result = "";
  for (let index = 0; index < entries.length; index += 1) {
    const current = entries[index];
    if (current.type === "word-gap") {
      if (!result.endsWith(" ")) result += " ";
      continue;
    }
    const next = entries[index + 1];
    if (next?.type === "char") {
      const merged = COMPOSED_FROM_PAIR[`${current.char}${next.char}`];
      if (merged) {
        result += merged;
        index += 1;
        continue;
      }
    }
    result += current.char;
  }
  return result;
}

function updateFlagsFromScreen(flags, rect, judgeX) {
  const headEnd = rect.left + Math.max(18, rect.width * 0.28);
  const bodyStart = rect.left + rect.width * 0.18;
  const bodyEnd = rect.left + rect.width * 0.82;
  const tailStart = rect.left + rect.width * 0.72;
  const tailEnd = rect.right + 10;
  if (judgeX >= rect.left - 10 && judgeX <= headEnd) flags.head = true;
  if (judgeX >= bodyStart && judgeX <= bodyEnd) flags.body = true;
  if (judgeX >= tailStart && judgeX <= tailEnd) flags.tail = true;
}

export default function WabunMorseAudioCanvas() {
  const [activeTab, setActiveTab] = useState("game");

  const [text, setText] = useState("こんにちは");
  const [unitMs, setUnitMs] = useState(360);
  const [frequency, setFrequency] = useState(650);
  const [volume, setVolume] = useState(0.18);

  const [sessionMode, setSessionMode] = useState("idle");
  const [countdown, setCountdown] = useState(3);
  const [nowMs, setNowMs] = useState(0);
  const [guideLampOn, setGuideLampOn] = useState(false);
  const [playerLampOn, setPlayerLampOn] = useState(false);
  const [status, setStatus] = useState("開始待ち");
  const [result, setResult] = useState(null);
  const [liveScore, setLiveScore] = useState(() => buildScoreState({ perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0 }, 0));
  const [judgePopup, setJudgePopup] = useState(null);

  const [isKeying, setIsKeying] = useState(false);
  const [manualCurrentCodeState, setManualCurrentCodeState] = useState("");
  const [manualRawEntriesState, setManualRawEntriesState] = useState([]);
  const [manualStatus, setManualStatus] = useState("未入力");

  const [builderCode, setBuilderCode] = useState("");
  const [builderEntries, setBuilderEntries] = useState([]);
  const [builderStatus, setBuilderStatus] = useState("短と長を並べてください");

  const audioCtxRef = useRef(null);
  const playerOscRef = useRef(null);
  const playerGainRef = useRef(null);
  const guideRunIdRef = useRef(0);
  const rafRef = useRef(null);
  const startAtRef = useRef(null);
  const laneRef = useRef(null);
  const [laneWidth, setLaneWidth] = useState(900);

  const keyHeldRef = useRef(false);
  const pressStartRef = useRef(null);
  const playerIntervalsRef = useRef([]);
  const inputActiveRef = useRef(false);

  const judgedNoteIdsRef = useRef(new Set());
  const noteJudgmentsRef = useRef(new Map());
  const noteFlagsRef = useRef(new Map());
  const scoreCountsRef = useRef({ perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0 });
  const popupTimerRef = useRef(null);

  const charTimerRef = useRef(null);
  const lastUpRef = useRef(null);
  const currentGroupRef = useRef(0);
  const manualCurrentCodeRef = useRef("");
  const manualRawEntriesRef = useRef([]);

  const encoded = useMemo(() => encodeText(text), [text]);
  const displayChars = useMemo(() => encoded.normalized.split("").filter((char) => char !== " " && char !== "　"), [encoded.normalized]);
  const rhythmData = useMemo(() => buildRhythmData(encoded.groups, unitMs), [encoded.groups, unitMs]);

  const judgeX = 132;
  const travelMs = Math.max(unitMs * 8, 2200);
  const leadInMs = Math.max(900, Math.round(travelMs * 0.5));
  const playableWidth = Math.max(420, laneWidth - judgeX - 32);
  const speedPxPerMs = playableWidth / travelMs;

  const timedNotes = useMemo(
    () => rhythmData.notes.map((note) => ({ ...note, hitStart: note.start + leadInMs, hitEnd: note.end + leadInMs })),
    [rhythmData.notes, leadInMs]
  );
  const timedRows = useMemo(
    () => rhythmData.rows.map((row) => ({ ...row, hitStart: row.start + leadInMs, hitEnd: row.end + leadInMs })),
    [rhythmData.rows, leadInMs]
  );

  const activeNote = useMemo(
    () => timedNotes.find((note) => nowMs >= note.hitStart && nowMs < note.hitEnd) || null,
    [timedNotes, nowMs]
  );

  const activeRowIndex = useMemo(() => {
    if (!timedRows.length) return -1;
    const activeIndex = timedRows.findIndex((row) => nowMs >= row.hitStart && nowMs < row.hitEnd);
    if (activeIndex !== -1) return activeIndex;
    const nextIndex = timedRows.findIndex((row) => nowMs < row.hitStart);
    return nextIndex === -1 ? timedRows.length - 1 : nextIndex;
  }, [timedRows, nowMs]);

  const activeRow = activeRowIndex >= 0 ? timedRows[activeRowIndex] : null;

  const manualDecodedText = useMemo(() => composeRawEntries(manualRawEntriesState), [manualRawEntriesState]);
  const manualPendingChar = useMemo(() => (manualCurrentCodeState ? WABUN_REVERSE[manualCurrentCodeState] || "?" : "—"), [manualCurrentCodeState]);
  const displayedScore = result ?? liveScore;
  const renderedPlayerIntervals = [
    ...playerIntervalsRef.current,
    ...(sessionMode === "running" && pressStartRef.current != null && startAtRef.current != null
      ? [{ start: pressStartRef.current - startAtRef.current, end: nowMs }]
      : []),
  ];

  const builderText = useMemo(() => composeRawEntries(builderEntries), [builderEntries]);
  const builderExactChar = useMemo(() => (builderCode ? WABUN_REVERSE[builderCode] || "" : ""), [builderCode]);
  const builderCandidates = useMemo(() => {
    if (!builderCode) return [];
    return BUILDER_CANDIDATES
      .filter(([, code]) => code.startsWith(builderCode))
      .sort((a, b) => {
        const aExact = a[1] === builderCode ? 1 : 0;
        const bExact = b[1] === builderCode ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return a[1].length - b[1].length;
      })
      .slice(0, 16);
  }, [builderCode]);

  useEffect(() => {
    setLiveScore(buildScoreState(scoreCountsRef.current, timedNotes.length));
  }, [timedNotes.length]);

  useEffect(() => {
    if (!laneRef.current) return undefined;
    const updateWidth = () => {
      if (laneRef.current) setLaneWidth(laneRef.current.clientWidth || 900);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(laneRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (charTimerRef.current) window.clearTimeout(charTimerRef.current);
      if (popupTimerRef.current) window.clearTimeout(popupTimerRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const isPlayKey = (event) => event.key === "Enter" || event.code === "Space" || event.key === " ";
    const keyboardListenerOptions = { passive: false, capture: true };
    const isTypingTarget = (target) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    };

    const blurNonTypingActiveElement = () => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      const tag = active.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || active.isContentEditable;
      if (!isTyping) active.blur();
    };

    if (sessionMode === "running") {
      const handleKeyDown = (event) => {
        if (!isPlayKey(event) || event.repeat) return;
        event.preventDefault();
        blurNonTypingActiveElement();
        if (keyHeldRef.current) return;
        keyHeldRef.current = true;
        handlePlayerPressStart();
      };

      const handleKeyUp = (event) => {
        if (!isPlayKey(event)) return;
        event.preventDefault();
        if (!keyHeldRef.current) return;
        keyHeldRef.current = false;
        handlePlayerPressEnd();
      };

      const handleBlur = () => {
        if (!keyHeldRef.current) return;
        keyHeldRef.current = false;
        handlePlayerPressEnd();
      };

      window.addEventListener("keydown", handleKeyDown, keyboardListenerOptions);
      window.addEventListener("keyup", handleKeyUp, keyboardListenerOptions);
      window.addEventListener("blur", handleBlur);
      return () => {
        window.removeEventListener("keydown", handleKeyDown, keyboardListenerOptions);
        window.removeEventListener("keyup", handleKeyUp, keyboardListenerOptions);
        window.removeEventListener("blur", handleBlur);
        keyHeldRef.current = false;
      };
    }

    if (sessionMode === "idle") {
      const handleIdleKeyDown = (event) => {
        if (!isPlayKey(event) || event.repeat) return;
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        blurNonTypingActiveElement();
        if (keyHeldRef.current) return;
        keyHeldRef.current = true;
        startIdleTone();
      };
      const handleIdleKeyUp = (event) => {
        if (!isPlayKey(event)) return;
        if (!keyHeldRef.current) return;
        event.preventDefault();
        keyHeldRef.current = false;
        stopIdleTone();
      };
      const handleIdleBlur = () => {
        if (!keyHeldRef.current) return;
        keyHeldRef.current = false;
        stopIdleTone();
      };
      window.addEventListener("keydown", handleIdleKeyDown, keyboardListenerOptions);
      window.addEventListener("keyup", handleIdleKeyUp, keyboardListenerOptions);
      window.addEventListener("blur", handleIdleBlur);
      return () => {
        window.removeEventListener("keydown", handleIdleKeyDown, keyboardListenerOptions);
        window.removeEventListener("keyup", handleIdleKeyUp, keyboardListenerOptions);
        window.removeEventListener("blur", handleIdleBlur);
        keyHeldRef.current = false;
      };
    }

    return undefined;
  }, [sessionMode]);

  function setManualCode(valueOrUpdater) {
    const nextValue = typeof valueOrUpdater === "function" ? valueOrUpdater(manualCurrentCodeRef.current) : valueOrUpdater;
    manualCurrentCodeRef.current = nextValue;
    setManualCurrentCodeState(nextValue);
  }

  function setManualEntries(valueOrUpdater) {
    const nextValue = typeof valueOrUpdater === "function" ? valueOrUpdater(manualRawEntriesRef.current) : valueOrUpdater;
    manualRawEntriesRef.current = nextValue;
    setManualRawEntriesState(nextValue);
  }

  function appendBuilderSymbol(symbol) {
    setBuilderCode((prev) => prev + symbol);
    setBuilderStatus(symbol === "・" ? "短を追加しました" : "長を追加しました");
  }

  function removeBuilderSymbol() {
    setBuilderCode((prev) => prev.slice(0, -1));
    setBuilderStatus("最後の記号を消しました");
  }

  function clearBuilderCode() {
    setBuilderCode("");
    setBuilderStatus("記号をクリアしました");
  }

  function confirmBuilderCharFromCode(code) {
    const char = WABUN_REVERSE[code];
    if (!char) {
      setBuilderStatus("この組み合わせには文字がありません");
      return;
    }
    setBuilderEntries((prev) => [...prev, { type: "char", char }]);
    setBuilderCode("");
    setBuilderStatus(`「${char}」を追加しました`);
  }

  function confirmBuilderChar() {
    if (!builderCode) {
      setBuilderStatus("先に短と長を並べてください");
      return;
    }
    confirmBuilderCharFromCode(builderCode);
  }

  function addBuilderSpace() {
    setBuilderEntries((prev) => [...prev, { type: "word-gap" }]);
    setBuilderStatus("スペースを追加しました");
  }

  function removeLastBuilderEntry() {
    setBuilderEntries((prev) => prev.slice(0, -1));
    setBuilderStatus("最後の文字を消しました");
  }

  function clearBuilderSentence() {
    setBuilderEntries([]);
    setBuilderCode("");
    setBuilderStatus("文章をクリアしました");
  }

  async function ensureAudio() {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function playGuideTone(duration) {
    await ensureAudio();
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = Math.max(220, frequency * 0.86);
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.48, now + 0.005);
    gain.gain.setValueAtTime(volume * 0.48, now + Math.max(duration / 1000 - 0.02, 0.01));
    gain.gain.linearRampToValueAtTime(0, now + duration / 1000);
    osc.start(now);
    osc.stop(now + duration / 1000 + 0.03);
    setGuideLampOn(true);
    await sleep(duration);
    setGuideLampOn(false);
  }

  async function startPlayerTone() {
    await ensureAudio();
    if (playerOscRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    osc.start(now);
    playerOscRef.current = osc;
    playerGainRef.current = gain;
    setPlayerLampOn(true);
  }

  function stopPlayerTone() {
    if (!audioCtxRef.current || !playerOscRef.current || !playerGainRef.current) {
      setPlayerLampOn(false);
      return;
    }
    const now = audioCtxRef.current.currentTime;
    playerGainRef.current.gain.cancelScheduledValues(now);
    playerGainRef.current.gain.setValueAtTime(volume, now);
    playerGainRef.current.gain.linearRampToValueAtTime(0, now + 0.04);
    try {
      playerOscRef.current.stop(now + 0.05);
    } catch {}
    playerOscRef.current = null;
    playerGainRef.current = null;
    setPlayerLampOn(false);
  }

  function startIdleTone() {
    if (sessionMode !== "idle") return;
    setStatus("待機中の音確認");
    startPlayerTone().catch(console.error);
  }

  function stopIdleTone() {
    stopPlayerTone();
    if (sessionMode === "idle") setStatus("開始待ち");
  }

  function clearGapTimers() {
    if (charTimerRef.current) {
      window.clearTimeout(charTimerRef.current);
      charTimerRef.current = null;
    }
  }

  function finalizeCurrentManualChar() {
    const code = manualCurrentCodeRef.current;
    if (!code) return;
    const groupId = currentGroupRef.current;
    const decodedChar = WABUN_REVERSE[code] || "?";
    setManualEntries([...manualRawEntriesRef.current, { type: "char", char: decodedChar, code, groupId }]);
    setManualCode("");
    currentGroupRef.current += 1;
    setManualStatus(decodedChar === "?" ? `未登録コード ${code}` : `「${decodedChar}」として確定`);
  }

  function scheduleGapDetection(releasedAt) {
    clearGapTimers();
    charTimerRef.current = window.setTimeout(() => {
      if (lastUpRef.current !== releasedAt) return;
      finalizeCurrentManualChar();
      setManualStatus("文字区切りを検出");
    }, unitMs * CHAR_GAP_UNITS);
  }

  function resetScoring() {
    judgedNoteIdsRef.current = new Set();
    noteJudgmentsRef.current = new Map();
    noteFlagsRef.current = new Map();
    scoreCountsRef.current = { perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0 };
    setLiveScore(buildScoreState(scoreCountsRef.current, timedNotes.length));
    setJudgePopup(null);
    if (popupTimerRef.current) {
      window.clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  }

  function pushJudgePopup(judgment) {
    const label = judgment === "perfect" ? "PERFECT" : judgment === "good" ? "GOOD" : "MISS";
    const color = judgment === "perfect" ? "text-emerald-300" : judgment === "good" ? "text-amber-300" : "text-rose-300";
    setJudgePopup({ id: Date.now() + Math.random(), label, color });
    if (popupTimerRef.current) window.clearTimeout(popupTimerRef.current);
    popupTimerRef.current = window.setTimeout(() => {
      setJudgePopup(null);
      popupTimerRef.current = null;
    }, 720);
  }

  function applyJudgment(noteId, judgment) {
    const next = { ...scoreCountsRef.current };
    if (judgment === "perfect") {
      next.perfect += 1;
      next.combo += 1;
    } else if (judgment === "good") {
      next.good += 1;
      next.combo += 1;
    } else {
      next.miss += 1;
      next.combo = 0;
    }
    next.maxCombo = Math.max(next.maxCombo, next.combo);
    scoreCountsRef.current = next;
    noteJudgmentsRef.current.set(noteId, judgment);
    setLiveScore(buildScoreState(next, timedNotes.length));
    pushJudgePopup(judgment);
  }

  function getInputIntervalsForJudging(elapsed) {
    return [
      ...playerIntervalsRef.current,
      ...(pressStartRef.current != null && startAtRef.current != null ? [{ start: pressStartRef.current - startAtRef.current, end: elapsed }] : []),
    ];
  }

  function settleDueNotes(elapsed) {
    const intervals = getInputIntervalsForJudging(elapsed);

    timedNotes.forEach((note) => {
      if (judgedNoteIdsRef.current.has(note.id)) return;
      const rect = getRenderedNoteRect(note, elapsed, judgeX, speedPxPerMs);
      if (rect.right >= judgeX - 14) return;

      judgedNoteIdsRef.current.add(note.id);
      const assessment = judgeSingleNote(note, intervals, unitMs);
      applyJudgment(note.id, assessment.judgment);
    });
  }

  async function handlePlayerPressStart() {
    if (!canStartPlayerPress(sessionMode, pressStartRef.current)) return;
    try {
      const now = performance.now();
      clearGapTimers();
      if (lastUpRef.current != null) {
        const gapDuration = now - lastUpRef.current;
        if (gapDuration >= unitMs * CHAR_GAP_UNITS) finalizeCurrentManualChar();
      }
      pressStartRef.current = now;
      inputActiveRef.current = true;
      setIsKeying(true);
      setManualStatus("入力中");
      await startPlayerTone();
    } catch (error) {
      console.error(error);
      setManualStatus("音声の初期化に失敗しました");
    }
  }

  function completePlayerTone(now, shouldScheduleGap = true) {
    if (pressStartRef.current == null) return;
    const toneDuration = now - pressStartRef.current;
    const symbol = toneDuration < unitMs * 2 ? "・" : "－";
    setManualCode((prev) => `${prev}${symbol}`);
    playerIntervalsRef.current = [...playerIntervalsRef.current, { start: pressStartRef.current - (startAtRef.current || 0), end: now - (startAtRef.current || 0) }];
    pressStartRef.current = null;
    inputActiveRef.current = false;
    lastUpRef.current = now;
    setIsKeying(false);
    stopPlayerTone();
    setManualStatus(`入力: ${symbol}`);
    if (shouldScheduleGap) scheduleGapDetection(now);
  }

  function handlePlayerPressEnd() {
    if (!canEndPlayerPress(sessionMode, pressStartRef.current)) return;
    completePlayerTone(performance.now(), true);
  }

  function clearInputState() {
    clearGapTimers();
    stopPlayerTone();
    inputActiveRef.current = false;
    setIsKeying(false);
    setManualStatus("未入力");
    setManualCode("");
    setManualEntries([]);
    setResult(null);
    resetScoring();
    pressStartRef.current = null;
    lastUpRef.current = null;
    currentGroupRef.current = 0;
    playerIntervalsRef.current = [];
  }

  function stopAnimationLoop() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function startAnimationLoop(runId, endMs, withJudging = false) {
    const tick = () => {
      if (guideRunIdRef.current !== runId || startAtRef.current == null) return;
      const elapsed = performance.now() - startAtRef.current;
      setNowMs(elapsed);
      if (withJudging) settleDueNotes(elapsed);
      if (elapsed <= endMs) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function runPreviewGuide(runId) {
    for (const note of timedNotes) {
      if (guideRunIdRef.current !== runId || startAtRef.current == null) return;
      const waitMs = startAtRef.current + note.hitStart - performance.now();
      if (waitMs > 0) await sleep(waitMs);
      if (guideRunIdRef.current !== runId) return;
      playGuideTone(note.duration).catch(console.error);
    }
  }

  async function preview() {
    if (!text.trim() || sessionMode !== "idle") return;
    clearInputState();
    guideRunIdRef.current += 1;
    const runId = guideRunIdRef.current;
    const runDuration = leadInMs + rhythmData.totalMs + 520;
    setSessionMode("preview");
    setStatus("見本再生中");
    setNowMs(0);
    startAtRef.current = performance.now();
    startAnimationLoop(runId, runDuration, false);
    runPreviewGuide(runId).catch(console.error);
    await sleep(runDuration + 40);
    if (guideRunIdRef.current !== runId) return;
    stopAnimationLoop();
    setGuideLampOn(false);
    setSessionMode("idle");
    setStatus("見本再生完了");
  }

  async function startGame() {
    if (!text.trim() || sessionMode !== "idle") return;
    clearInputState();
    guideRunIdRef.current += 1;
    const runId = guideRunIdRef.current;
    const runDuration = leadInMs + rhythmData.totalMs + 520;
    setSessionMode("countdown");
    setStatus("まもなく開始");
    await ensureAudio();
    for (let value = 3; value >= 1; value -= 1) {
      if (guideRunIdRef.current !== runId) return;
      setCountdown(value);
      await sleep(700);
    }
    if (guideRunIdRef.current !== runId) return;
    setGuideLampOn(false);
    setSessionMode("running");
    setStatus("重なっている間だけ押す");
    setNowMs(0);
    startAtRef.current = performance.now();
    startAnimationLoop(runId, runDuration, true);
    await sleep(runDuration + 40);
    if (guideRunIdRef.current !== runId) return;
    const now = performance.now();
    if (pressStartRef.current != null) completePlayerTone(now, false);
    if (manualCurrentCodeRef.current) finalizeCurrentManualChar();
    settleDueNotes(runDuration + unitMs * 3);
    stopAnimationLoop();
    setGuideLampOn(false);
    setSessionMode("idle");
    setStatus("リザルト");
    setResult(buildScoreState(scoreCountsRef.current, timedNotes.length));
  }

  function stopAll() {
    guideRunIdRef.current += 1;
    stopAnimationLoop();
    clearGapTimers();
    stopPlayerTone();
    inputActiveRef.current = false;
    setGuideLampOn(false);
    setSessionMode("idle");
    setStatus("停止");
    if (pressStartRef.current != null) completePlayerTone(performance.now(), false);
    if (manualCurrentCodeRef.current) finalizeCurrentManualChar();
    settleDueNotes(nowMs + unitMs * 3);
    if (timedNotes.length) setResult(buildScoreState(scoreCountsRef.current, timedNotes.length));
  }

  const cueLabel =
    sessionMode === "countdown" ? `${countdown}`
    : sessionMode === "running" ? (activeNote ? "いま押す" : "いま離す")
    : sessionMode === "preview" ? (activeNote ? "ガイド再生中" : "まもなく来る")
    : "待機中";

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="rounded-3xl shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full">Canvasデモ</Badge>
              <Badge variant="secondary" className="rounded-full">和文モールス</Badge>
              <Badge variant="outline" className="rounded-full">学習UI</Badge>
            </div>
            <CardTitle className="mt-2 text-2xl">和文モールス</CardTitle>
            <CardDescription>
              音ゲーと、短 / 長の組み合わせからひらがなを作るタブを切り替えられます。
            </CardDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={activeTab === "game" ? "default" : "outline"} className="rounded-2xl" onMouseDown={(event) => event.preventDefault()} onClick={() => setActiveTab("game")}>
                音ゲー
              </Button>
              <Button variant={activeTab === "builder" ? "default" : "outline"} className="rounded-2xl" onMouseDown={(event) => event.preventDefault()} onClick={() => setActiveTab("builder")}>
                短 / 長 で文字を作る
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTab === "game" ? (
              <>
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-700">文を入力</div>
                      <Textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-24 rounded-2xl bg-white" placeholder="たとえば：こんにちは" />
                    </div>

                    <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      待機中は、ページ上のどこからでも Space / Enter で音確認できます。ゲーム開始は音ゲー開始ボタンです。
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_TEXTS.map((sample) => (
                        <Button key={sample} variant="secondary" className="rounded-2xl" onMouseDown={(event) => event.preventDefault()} onClick={() => setText(sample)}>
                          {sample}
                        </Button>
                      ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border bg-white p-4">
                        <div className="mb-2 text-sm font-medium text-slate-700">速さ</div>
                        <Slider value={[unitMs]} min={120} max={720} step={20} onValueChange={(value) => setUnitMs(value[0])} />
                        <div className="mt-2 text-sm text-slate-600">1単位 = {unitMs}ms</div>
                      </div>
                      <div className="rounded-2xl border bg-white p-4">
                        <div className="mb-2 text-sm font-medium text-slate-700">音の高さ</div>
                        <Slider value={[frequency]} min={300} max={1200} step={10} onValueChange={(value) => setFrequency(value[0])} />
                        <div className="mt-2 text-sm text-slate-600">{frequency}Hz</div>
                      </div>
                      <div className="rounded-2xl border bg-white p-4">
                        <div className="mb-2 text-sm font-medium text-slate-700">音量</div>
                        <Slider value={[Math.round(volume * 100)]} min={0} max={60} step={1} onValueChange={(value) => setVolume(value[0] / 100)} />
                        <div className="mt-2 text-sm text-slate-600">{Math.round(volume * 100)}%</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button onMouseDown={(event) => event.preventDefault()} onClick={preview} disabled={!text.trim() || sessionMode !== "idle"} className="h-11 rounded-2xl px-5">
                        <Play className="mr-2 h-4 w-4" />
                        見本だけ流す
                      </Button>
                      <Button onMouseDown={(event) => event.preventDefault()} onClick={startGame} disabled={!text.trim() || sessionMode !== "idle"} className="h-11 rounded-2xl px-5">
                        <Target className="mr-2 h-4 w-4" />
                        音ゲー開始
                      </Button>
                      <Button variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={stopAll} disabled={sessionMode === "idle"} className="h-11 rounded-2xl px-5">
                        <Square className="mr-2 h-4 w-4" />
                        停止
                      </Button>
                      <Button variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={clearInputState} className="h-11 rounded-2xl px-5">
                        <RotateCcw className="mr-2 h-4 w-4" />
                        入力クリア
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm font-medium text-slate-700">いまの合図</div>
                      <div className="mt-2 text-4xl font-bold text-slate-900">{cueLabel}</div>
                      <div className="mt-2 text-sm text-slate-600">対象文字: {activeRow?.char || activeNote?.charLabel || "—"}</div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-3xl border bg-amber-50 p-4 text-center">
                          <div className="text-xs font-medium text-amber-700">ガイド光</div>
                          <div className={`mx-auto mt-3 h-16 w-16 rounded-full border-4 transition-all ${guideLampOn ? "animate-pulse border-amber-300 bg-amber-300 shadow-[0_0_40px_rgba(252,211,77,0.95)]" : "border-amber-100 bg-amber-100/40"}`} />
                          <div className="mt-3 text-sm text-amber-800">{guideLampOn ? "ON" : "OFF"}</div>
                        </div>
                        <div className="rounded-3xl border bg-sky-50 p-4 text-center">
                          <div className="text-xs font-medium text-sky-700">あなたの光</div>
                          <div className={`mx-auto mt-3 h-16 w-16 rounded-full border-4 transition-all ${playerLampOn ? "animate-pulse border-sky-300 bg-sky-300 shadow-[0_0_40px_rgba(125,211,252,0.95)]" : "border-sky-100 bg-sky-100/40"}`} />
                          <div className="mt-3 text-sm text-sky-800">{playerLampOn ? "ON" : "OFF"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm font-medium text-slate-700">リアルタイムスコア</div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">スコア</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900">{displayedScore.total ? `${displayedScore.score}%` : "—"}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">手入力の解読（参考）</div>
                          <div className="mt-1 text-lg font-bold text-slate-900">{manualDecodedText || "—"}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">Perfect / Good</div>
                          <div className="mt-1 text-lg font-bold text-slate-900">{displayedScore.total ? `${displayedScore.perfect} / ${displayedScore.good}` : "—"}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">Miss</div>
                          <div className="mt-1 text-lg font-bold text-slate-900">{displayedScore.total ? `${displayedScore.miss}` : "—"}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">コンボ</div>
                          <div className="mt-1 text-lg font-bold text-slate-900">{displayedScore.total ? `${displayedScore.combo}` : "—"}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">最大コンボ</div>
                          <div className="mt-1 text-lg font-bold text-slate-900">{displayedScore.total ? `${displayedScore.maxCombo}` : "—"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border bg-slate-950 p-4 text-white">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-300">文字ガイド</div>
                      <div className="text-xl font-semibold">今やっている文字を上で大きく表示</div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Lightbulb className="h-4 w-4" />
                      音ゲー中はガイド音もガイド光もなし。流れてくるノーツだけを見る
                    </div>
                  </div>

                  <div className="mb-3 overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/70 p-4">
                    <div className="flex min-w-max items-center gap-3">
                      {displayChars.map((char, index) => {
                        const isCurrent = index === activeRowIndex;
                        const isPast = activeRowIndex > index;
                        return (
                          <div key={`${char}-${index}`} className={`flex h-20 w-20 items-center justify-center rounded-3xl border text-4xl font-black transition-all ${isCurrent ? "scale-105 border-emerald-300 bg-emerald-300/20 text-white shadow-[0_0_26px_rgba(52,211,153,0.35)]" : isPast ? "border-slate-600 bg-slate-800 text-slate-300" : "border-slate-700 bg-slate-900 text-slate-500"}`}>
                            {char}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-300">レーン</div>
                      <div className="text-xl font-semibold">白い縦線そのものが判定ライン</div>
                    </div>
                    <div className="text-sm text-slate-300">待機中は音確認。ゲーム開始はボタン。ゲーム中はノーツだけで判定</div>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-amber-100">黄色のノーツ = 判定対象</span>
                    <span className="rounded-full border border-sky-300/40 bg-sky-300/15 px-3 py-1 text-sky-100">青い光 = あなたの入力</span>
                  </div>

                  <div ref={laneRef} className="relative h-44 overflow-hidden rounded-3xl border border-slate-800 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)]">
                    {judgePopup ? (
                      <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center">
                        <div key={judgePopup.id} className={`rounded-full bg-slate-950/80 px-5 py-2 text-2xl font-black tracking-wider ${judgePopup.color} shadow-[0_0_25px_rgba(15,23,42,0.65)] animate-pulse`}>
                          {judgePopup.label}
                        </div>
                      </div>
                    ) : null}

                    <div className="absolute inset-y-0 z-20 w-[3px] bg-white shadow-[0_0_28px_rgba(255,255,255,0.92)]" style={{ left: judgeX }} />
                    <div className="absolute inset-y-0 z-10 w-14 rounded-full bg-white/12" style={{ left: judgeX - 18 }} />
                    <div className={`absolute inset-y-0 z-10 w-40 transition-all ${playerLampOn ? "bg-sky-300/16 shadow-[0_0_65px_rgba(125,211,252,0.45)]" : "bg-transparent"}`} style={{ left: judgeX - 34 }} />
                    <div className="absolute left-0 right-0 top-0 h-full bg-[repeating-linear-gradient(90deg,transparent_0px,transparent_119px,rgba(255,255,255,0.04)_120px)]" />
                    <div className="absolute left-0 right-0 top-[94px] h-16 border-t border-b border-slate-800/80" />
                    <div className="absolute z-20 flex flex-col items-center" style={{ left: judgeX - 34, top: 4 }}>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-950 shadow-lg">判定ライン</div>
                    </div>

                    {renderedPlayerIntervals.map((interval, index) => {
                      const left = judgeX + (interval.start - nowMs) * speedPxPerMs;
                      const width = Math.max((interval.end - interval.start) * speedPxPerMs, 14);
                      if (left + width < -50 || left > laneWidth + 100) return null;
                      return (
                        <div
                          key={`player-interval-${index}-${interval.start}`}
                          className="absolute top-[102px] z-10 h-16 rounded-full border border-sky-300/60 bg-sky-300/25"
                          style={{ left, width, transform: "translateY(-50%)" }}
                        />
                      );
                    })}

                    {timedNotes.map((note) => {
                      const x = judgeX + (note.hitStart - nowMs) * speedPxPerMs;
                      const width = Math.max(note.duration * speedPxPerMs, note.kind === "dot" ? 54 : 92);
                      if (x + width < -50 || x > laneWidth + 100) return null;
                      const isActive = activeNote?.id === note.id;
                      const judgment = noteJudgmentsRef.current.get(note.id);
                      const colorClass =
                        judgment === "perfect" ? "border-emerald-300 bg-emerald-200 text-slate-950" :
                        judgment === "good" ? "border-amber-300 bg-amber-200 text-slate-950" :
                        judgment === "miss" ? "border-rose-300 bg-rose-200 text-slate-950" :
                        isActive ? "border-amber-300 bg-amber-300 text-slate-950 shadow-[0_0_35px_rgba(252,211,77,0.6)]" :
                        "border-amber-200 bg-amber-100 text-slate-950";
                      return (
                        <div key={note.id} className={`absolute top-[102px] z-20 h-16 rounded-full border-2 ${colorClass}`} style={{ left: x, width, transform: "translateY(-50%)" }}>
                          <div className="flex h-full items-center justify-center text-2xl font-bold">{note.kind === "dot" ? "・" : "—"}</div>
                        </div>
                      );
                    })}

                    <div className={`absolute z-30 rounded-full border-2 transition-all ${isKeying ? "border-sky-300 bg-sky-300/20 shadow-[0_0_40px_rgba(125,211,252,0.45)]" : "border-white/20 bg-white/5"}`} style={{ left: judgeX - 34, top: 70, width: 220, height: 64 }} />

                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-slate-400">
                      <span>右から流れる</span>
                      <span>白い縦線に来たら押す</span>
                      <span>点は軽く、線は長押し</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                      if (sessionMode === "running") handlePlayerPressStart();
                      else if (sessionMode === "idle") startIdleTone();
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      if (sessionMode === "running") handlePlayerPressEnd();
                      else if (sessionMode === "idle") stopIdleTone();
                    }}
                    onPointerCancel={() => {
                      if (sessionMode === "running") handlePlayerPressEnd();
                      else if (sessionMode === "idle") stopIdleTone();
                    }}
                    onPointerLeave={() => {
                      if (canEndPlayerPress(sessionMode, pressStartRef.current)) handlePlayerPressEnd();
                      if (sessionMode === "idle") stopIdleTone();
                    }}
                    disabled={sessionMode === "countdown" || sessionMode === "preview"}
                    className={`mt-4 flex h-24 w-full items-center justify-center rounded-3xl border text-lg font-semibold transition-all ${isKeying ? "border-sky-300 bg-sky-300/20 text-white shadow-[0_0_28px_rgba(125,211,252,0.35)]" : "border-slate-700 bg-slate-900 text-slate-200"} ${sessionMode === "countdown" || sessionMode === "preview" ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-900/80"}`}
                  >
                    {sessionMode === "countdown" ? `${countdown}` : sessionMode === "running" ? (isKeying ? "押している間、あなたの音と光がON" : "Enter / Space またはここを長押し") : sessionMode === "preview" ? "見本再生中はここでは押せない" : playerLampOn ? "待機中の音確認中" : "待機中はどこでも Space / Enter、またはここを押して音確認できる"}
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-medium text-slate-700">次に来る文字</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {timedRows.slice(Math.max(0, activeRowIndex), Math.max(0, activeRowIndex) + 6).length ? (
                        timedRows.slice(Math.max(0, activeRowIndex), Math.max(0, activeRowIndex) + 6).map((row, index) => (
                          <div key={`${row.char}-${index}`} className={`rounded-2xl border px-3 py-2 ${index === 0 ? "border-emerald-300 bg-emerald-50" : "bg-slate-50"}`}>
                            <div className="text-lg font-bold text-slate-900">{row.char}</div>
                            <div className="mt-1 font-mono text-xs text-slate-600">{row.code}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500">まだ表示できる文字がありません。</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-medium text-slate-700">あなたの入力</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">いまのコード</div>
                        <div className="mt-1 font-mono text-xl font-bold text-slate-900">{manualCurrentCodeState || "—"}</div>
                        <div className="mt-1 text-xs text-slate-500">仮の候補: {manualPendingChar}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">手入力の解読（参考）</div>
                        <div className="mt-1 text-xl font-bold text-slate-900">{manualDecodedText || "—"}</div>
                        <div className="mt-1 text-xs text-slate-500">{manualStatus}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  見本再生ではガイド音とガイド光がありますが、音ゲー中はどちらも使いません。青いバーがあなたの実入力です。採点はその青いバーとノーツの重なりをもとに行います。
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm font-medium text-slate-700">いま作っている1文字</div>
                      <div className="mt-3 rounded-3xl bg-slate-50 p-5">
                        <div className="font-mono text-3xl font-black tracking-widest text-slate-900 min-h-10">{builderCode || "—"}</div>
                        <div className="mt-3 text-sm text-slate-600">一致する文字: <span className="font-bold text-slate-900">{builderExactChar || "まだなし"}</span></div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <Button className="h-14 rounded-2xl text-lg" onMouseDown={(event) => event.preventDefault()} onClick={() => appendBuilderSymbol("・")}>短</Button>
                        <Button className="h-14 rounded-2xl text-lg" onMouseDown={(event) => event.preventDefault()} onClick={() => appendBuilderSymbol("－")}>長</Button>
                        <Button variant="outline" className="h-12 rounded-2xl" onMouseDown={(event) => event.preventDefault()} onClick={removeBuilderSymbol}>1記号消す</Button>
                        <Button variant="outline" className="h-12 rounded-2xl" onMouseDown={(event) => event.preventDefault()} onClick={clearBuilderCode}>記号クリア</Button>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm font-medium text-slate-700">1文字を確定する</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button className="rounded-2xl" onMouseDown={(event) => event.preventDefault()} onClick={confirmBuilderChar}>この組み合わせで追加</Button>
                        <Button variant="outline" className="rounded-2xl" onMouseDown={(event) => event.preventDefault()} onClick={addBuilderSpace}>スペース追加</Button>
                        <Button variant="outline" className="rounded-2xl" onMouseDown={(event) => event.preventDefault()} onClick={removeLastBuilderEntry}>最後の文字を消す</Button>
                        <Button variant="outline" className="rounded-2xl" onMouseDown={(event) => event.preventDefault()} onClick={clearBuilderSentence}>文章クリア</Button>
                      </div>
                      <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{builderStatus}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm font-medium text-slate-700">候補</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {builderCode ? (
                          builderCandidates.length ? (
                            builderCandidates.map(([char, code]) => {
                              const exact = code === builderCode;
                              return (
                                <button
                                  key={`${char}-${code}`}
                                  type="button"
                                  onClick={() => confirmBuilderCharFromCode(code)}
                                  className={`rounded-2xl border px-4 py-3 text-left transition-all ${exact ? "border-emerald-300 bg-emerald-50" : "bg-slate-50 hover:bg-slate-100"}`}
                                >
                                  <div className="text-xl font-bold text-slate-900">{char}</div>
                                  <div className="mt-1 font-mono text-xs text-slate-600">{code}</div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="text-sm text-slate-500">候補がありません。</div>
                          )
                        ) : (
                          <div className="text-sm text-slate-500">短 / 長を入れると候補が出ます。</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-4">
                      <div className="text-sm font-medium text-slate-700">作った文字列</div>
                      <div className="mt-3 rounded-3xl bg-slate-50 p-5 text-3xl font-black tracking-wide text-slate-900 min-h-16">
                        {builderText || "—"}
                      </div>
                      <div className="mt-3 text-sm text-slate-600">
                        濁点・半濁点も作れます。たとえば <span className="font-mono">か</span> を追加したあとに <span className="font-mono">゛</span> を追加すると、表示は <span className="font-bold">が</span> になります。
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      使い方はシンプルです。短 / 長を押して1文字のコードを作る → 一致する候補を確認 → 文字を確定、の流れです。
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
