"use client";

import { useEffect, useRef, useState } from "react";
import {
  INTRO_ACTIONS,
  INTRO_CAPTIONS,
  INTRO_DURATION_SECONDS,
  INTRO_SOURCE_END_SECONDS,
  INTRO_SOURCE_START_SECONDS,
  cueAt,
} from "./intro-content";

export type IntroMode = "motion" | "safe";

type Props = {
  stage: "consent" | "playing";
  mode: IntroMode;
  onChooseMode: (mode: IntroMode) => void;
  onRefuse: () => void;
  onFinish: () => void;
};

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function IntroExperience({
  stage,
  mode,
  onChooseMode,
  onRefuse,
  onFinish,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [actionNotes, setActionNotes] = useState(mode === "safe");
  const [time, setTime] = useState(0);

  useEffect(() => {
    headingRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    const syncActionNotes = window.setTimeout(() => {
      setActionNotes(mode === "safe");
    }, 0);
    return () => window.clearTimeout(syncActionNotes);
  }, [mode]);

  useEffect(() => {
    if (stage !== "playing") return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = INTRO_SOURCE_START_SECONDS;
    setTime(0);
    void video.play().catch(() => setPlaying(false));
  }, [stage]);

  if (stage === "consent") {
    return (
      <main className="intro-gate" aria-labelledby="intro-warning-title">
        <section className="intro-consent-panel">
          <p className="eyebrow">BEFORE THE OBSERVATION PORT OPENS</p>
          <h1 id="intro-warning-title" ref={headingRef} tabIndex={-1}>
            CHOOSE HOW THE WAR INTRODUCES ITSELF
          </h1>
          <p className="intro-lede">
            This optional 29 second cinematic contains stylized but
            graphic Great War violence, blood, death and corpses, fleshy
            war-machine anatomy, body horror, artillery and weapon impacts,
            abrupt brightness changes, and intense sound.
          </p>
          <div className="intro-warning-grid">
            <article>
              <strong>FLASHING / PHOTOSENSITIVITY</strong>
              <p>Intermittent bright explosions and abrupt light-to-dark cuts occur.</p>
            </article>
            <article>
              <strong>YOU KEEP CONTROL</strong>
              <p>Pause, scrub, mute, use captions, or skip at any time. There is no time pressure.</p>
            </article>
          </div>
          <nav className="intro-choice-actions" aria-label="Intro presentation choices">
            <button type="button" onClick={() => onChooseMode("safe")}>
              <strong>PLAY SAFER PRESENTATION</strong>
              <span>29 seconds · static image · soundtrack · captions · action descriptions</span>
            </button>
            <button type="button" onClick={() => onChooseMode("motion")}>
              <strong>PLAY FULL-MOTION CINEMATIC</strong>
              <span>29 seconds · 12 fps video · captions on · all playback controls</span>
            </button>
            <button type="button" className="intro-refuse" onClick={onRefuse}>
              <strong>REFUSE INTRO · CONTINUE TO MENU</strong>
              <span>The game remains complete. This choice is remembered on this device.</span>
            </button>
          </nav>
          <details className="intro-transcript">
            <summary>Read visual action overview</summary>
            <ol>
              {INTRO_ACTIONS.map((action) => (
                <li key={action.start}>
                  <b>{formatTime(action.start)}–{formatTime(action.end)}</b> {action.text}
                </li>
              ))}
            </ol>
          </details>
        </section>
      </main>
    );
  }

  const caption = cueAt(INTRO_CAPTIONS, time);
  const action = cueAt(INTRO_ACTIONS, time);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  return (
    <main className={`intro-player intro-player-${mode}`} aria-labelledby="intro-player-title">
      <h1 id="intro-player-title" ref={headingRef} tabIndex={-1} className="sr-only">
        Through the Slit introduction, {mode === "safe" ? "safer static presentation" : "full-motion presentation"}
      </h1>
      <section className="intro-stage">
        <video
          ref={videoRef}
          src="./cinematics/through-the-slit-intro-v4.mp4"
          poster="/mendels-procession-hero.webp"
          playsInline
          preload="metadata"
          muted={muted}
          onPlay={(event) => {
            if (
              event.currentTarget.currentTime < INTRO_SOURCE_START_SECONDS ||
              event.currentTarget.currentTime >= INTRO_SOURCE_END_SECONDS
            ) {
              event.currentTarget.currentTime = INTRO_SOURCE_START_SECONDS;
              setTime(0);
            }
            setPlaying(true);
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => {
            const sourceTime = event.currentTarget.currentTime;
            if (sourceTime >= INTRO_SOURCE_END_SECONDS) {
              event.currentTarget.pause();
              onFinish();
              return;
            }
            setTime(Math.max(0, sourceTime - INTRO_SOURCE_START_SECONDS));
          }}
          onEnded={onFinish}
          aria-label={mode === "safe" ? "Intro soundtrack; moving imagery suppressed" : "Through the Slit full-motion intro cinematic"}
        >
          <track
            kind="captions"
            src="./captions/through-the-slit-intro-v4.en.vtt"
            srcLang="en"
            label="English"
          />
        </video>
        {mode === "safe" ? (
          <div className="intro-safe-poster" aria-hidden="true">
            <img src="/mendels-procession-hero.webp" alt="" />
            <span>SAFER STATIC PRESENTATION · MOVING IMAGERY SUPPRESSED</span>
          </div>
        ) : null}
        {captions && caption ? (
          <p className="intro-caption" aria-live="polite">{caption}</p>
        ) : null}
        {actionNotes && action ? (
          <p className="intro-action-note" aria-live="polite">
            <strong>VISUAL ACTION</strong> {action}
          </p>
        ) : null}
      </section>
      <section className="intro-controls" aria-label="Intro playback controls">
        <button type="button" onClick={togglePlayback}>{playing ? "PAUSE" : "PLAY"}</button>
        <label>
          <span className="sr-only">Cinematic position</span>
          <input
            type="range"
            min="0"
            max={INTRO_DURATION_SECONDS}
            step="0.1"
            value={Math.min(time, INTRO_DURATION_SECONDS)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (videoRef.current) {
                videoRef.current.currentTime = INTRO_SOURCE_START_SECONDS + next;
              }
              setTime(next);
            }}
          />
        </label>
        <output aria-live="off">{formatTime(time)} / 0:29</output>
        <button type="button" aria-pressed={muted} onClick={() => setMuted((value) => !value)}>
          {muted ? "SOUND OFF" : "SOUND ON"}
        </button>
        <button type="button" aria-pressed={captions} onClick={() => setCaptions((value) => !value)}>
          CAPTIONS {captions ? "ON" : "OFF"}
        </button>
        <button type="button" aria-pressed={actionNotes} onClick={() => setActionNotes((value) => !value)}>
          ACTION NOTES {actionNotes ? "ON" : "OFF"}
        </button>
        <button type="button" className="intro-skip" onClick={onFinish}>SKIP INTRO</button>
      </section>
    </main>
  );
}
