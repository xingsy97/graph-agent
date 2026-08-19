"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import type { ReplayRecording } from "@graph-agent/domain";

export function ReplayControls({
  recording,
  timeMs,
  playing,
  speed,
  onTime,
  onPlaying,
  onSpeed,
}: {
  recording: ReplayRecording;
  timeMs: number;
  playing: boolean;
  speed: number;
  onTime(value: number): void;
  onPlaying(value: boolean): void;
  onSpeed(value: number): void;
}) {
  return (
    <section className="replay-controls" aria-label="Replay controls">
      <span className="replay-badge">Recorded replay</span>
      <button
        aria-label={playing ? "Pause replay" : "Play replay"}
        onClick={() => onPlaying(!playing)}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        aria-label="Restart replay"
        onClick={() => {
          onTime(0);
          onPlaying(false);
        }}
      >
        <RotateCcw size={15} />
      </button>
      <input
        aria-label="Replay timeline"
        type="range"
        min={0}
        max={Math.max(0, recording.durationMs)}
        step={100}
        value={timeMs}
        onChange={(event) => {
          onTime(Number(event.target.value));
          onPlaying(false);
        }}
      />
      <time>
        {formatOffset(timeMs)} / {formatOffset(recording.durationMs)}
      </time>
      <select
        aria-label="Replay speed"
        value={speed}
        onChange={(event) => onSpeed(Number(event.target.value))}
      >
        <option value={0.5}>0.5×</option>
        <option value={1}>1×</option>
        <option value={2}>2×</option>
        <option value={4}>4×</option>
        <option value={10}>10×</option>
        <option value={15}>15×</option>
      </select>
    </section>
  );
}

function formatOffset(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
