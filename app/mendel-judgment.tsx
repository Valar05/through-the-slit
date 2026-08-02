"use client";

import { useMemo, useState } from "react";
import {
  JUDGMENT_DECISIONS,
  LINEAGE_STATES,
  PERFECT_REPRODUCTION_OFFER,
  evaluateMendelRails,
  judgeObservedLineage,
} from "./inheritance-model.mjs";

export const LINEAGE_ARCHIVE_KEY = "through-the-slit.lineages.v1";

type RailStatus = "evidenced" | "unknown" | "contested";
type JudgmentDecision = "submit" | "defer" | "destroy";
type ObservedLineage = {
  schemaVersion: number;
  lineageId: string;
  state: string;
  generations: Array<{
    runId: string;
    eventId: string;
    elapsed: number;
    cost: {
      armorDamage: number;
      organDamage: number;
      suppressionPeak: number;
      exposedSeconds: number;
    };
    outcome: {
      recoveredDistance: number;
      assetIntegrityAfter: number;
      formationConnectedAfter: boolean;
      formationCohesionAfter: number;
    };
  }>;
  judgmentReceipts: Array<Record<string, unknown>>;
  unlockPoolEligible: boolean;
};
type JudgmentRail = {
  rail: string;
  status: RailStatus;
  finding: string;
  evidence: string;
};

const inspectRails = evaluateMendelRails as unknown as (
  lineage: ObservedLineage,
) => JudgmentRail[];
const issueJudgment = judgeObservedLineage as unknown as (
  lineage: ObservedLineage,
  decision: JudgmentDecision,
) => ObservedLineage;

const RAIL_LABELS: Record<string, string> = {
  useful_trait: "Useful trait",
  durable_transfer: "Durable transfer",
  hybridization: "Hybridization",
  humane_context: "Humane context",
  vessel_release: "Vessel release",
  absolute_containment: "Absolute containment",
};

const STATUS_LABELS: Record<RailStatus, string> = {
  evidenced: "EVIDENCED",
  unknown: "UNKNOWN",
  contested: "CONTESTED",
};

export function loadLineageInState(state: string): ObservedLineage | null {
  try {
    const stored = window.localStorage.getItem(LINEAGE_ARCHIVE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const records = Array.isArray(parsed) ? parsed : [parsed];
    const candidate = (
      records.find(
        (record) =>
          record?.lineageId === "martyrs-winch" &&
          record?.state === state &&
          Array.isArray(record?.generations) &&
          record.generations.length >= 1 &&
          Array.isArray(record?.judgmentReceipts),
      ) ?? null
    );
    return candidate;
  } catch {
    return null;
  }
}

export function loadObservedLineage(): ObservedLineage | null {
  return loadLineageInState(LINEAGE_STATES.OBSERVED);
}

export function loadSubmittedLineage(): ObservedLineage | null {
  return loadLineageInState(LINEAGE_STATES.SUBMITTED);
}

export function persistLineage(lineage: ObservedLineage) {
  const stored = window.localStorage.getItem(LINEAGE_ARCHIVE_KEY);
  let records: Array<Record<string, unknown>> = [];
  try {
    const parsed = stored ? JSON.parse(stored) : [];
    records = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    records = [];
  }
  const next = records.filter((record) => record?.lineageId !== lineage.lineageId);
  next.push(lineage);
  window.localStorage.setItem(LINEAGE_ARCHIVE_KEY, JSON.stringify(next));
}

export default function MendelJudgment({
  candidate,
  onClose,
}: {
  candidate: ObservedLineage;
  onClose: () => void;
}) {
  const [lineage, setLineage] = useState(candidate);
  const [confirming, setConfirming] = useState<JudgmentDecision | null>(null);
  const rails = useMemo(() => inspectRails(lineage), [lineage]);
  const receipt = lineage.judgmentReceipts.at(-1) as
    | { verdict?: string; decision?: JudgmentDecision; receiptId?: string }
    | undefined;

  const decide = (decision: JudgmentDecision) => {
    const judged = issueJudgment(lineage, decision);
    persistLineage(judged);
    setLineage(judged);
    setConfirming(null);
  };

  return (
    <section
      className="mendel-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mendel-title"
      data-lineage-state={lineage.state}
    >
      <div className="mendel-instrument" data-decision={receipt?.decision ?? "pending"}>
        <header className="mendel-header">
          <div>
            <p className="eyebrow">SAINT MENDEL // FIRST GENERATION</p>
            <h2 id="mendel-title">MARTYR&apos;S WINCH</h2>
            <p>
              The landship recovered a living body under fire. The mechanism is
              not the inheritance claim. The responsibility is under judgment.
            </p>
          </div>
          <div className="specimen-seal" aria-hidden="true">
            <i />
            <b>Ⅰ</b>
            <span>OBSERVED</span>
          </div>
        </header>

        <div className="mendel-body">
          <figure className="battlefield-witness" aria-label="Recovered battlefield evidence">
            <div className="witness-plate" aria-hidden="true">
              <i className="witness-landship" />
              <i className="witness-tendon" />
              <i className="witness-body" />
              <i className="witness-ground" />
            </div>
            <figcaption>
              <strong>WITNESS {lineage.generations[0].eventId}</strong>
              <span>
                {Math.round(lineage.generations[0].outcome.recoveredDistance)}m
                recovered · {Math.round(lineage.generations[0].cost.exposedSeconds)}s
                exposed · {Math.round(lineage.generations[0].outcome.formationCohesionAfter)}%
                formation cohesion
              </span>
              <small>TRAIT CANDIDATE ≠ GRAFT ≠ TAUGHT DOCTRINE</small>
            </figcaption>
            <aside className="counterfeit-offer" aria-label="Rejected perfect reproduction offer">
              <strong>COUNTERFEIT</strong>
              <span>PERFECT LANDSHIP REPRODUCTION REJECTED</span>
              <small>
                FAILS {PERFECT_REPRODUCTION_OFFER.failedRail.replaceAll("_", " ")} · responsibility remains captive to its first vessel
              </small>
            </aside>
          </figure>

          <ol className="judgment-rails" aria-label="Six Mendel judgment rails">
            {rails.map((rail, index) => (
              <li key={rail.rail} data-status={rail.status}>
                <span className="rail-mark" aria-hidden="true">{index + 1}</span>
                <div>
                  <strong>{RAIL_LABELS[rail.rail]}</strong>
                  <p>{rail.finding}</p>
                  <small>{rail.evidence}</small>
                </div>
                <b>{STATUS_LABELS[rail.status]}</b>
              </li>
            ))}
          </ol>
        </div>

        {receipt ? (
          <footer className="judgment-receipt" aria-live="assertive">
            <p className="eyebrow">JUDGMENT RECEIPT</p>
            <blockquote>{receipt.verdict}</blockquote>
            <span>
              {receipt.receiptId} · NO UNLOCK GRANTED · POSSIBILITY POOL UNCHANGED
            </span>
            <button type="button" onClick={onClose} autoFocus>
              RETURN TO THE DEAD LANDSHIP
            </button>
          </footer>
        ) : confirming ? (
          <footer className="judgment-confirm" role="alertdialog" aria-modal="true">
            <strong>
              {confirming === "submit"
                ? "Release this claim from the landship's custody?"
                : confirming === "destroy"
                  ? "Destroy this candidate and contain its lineage?"
                  : "Retain the evidence without asking it to advance?"}
            </strong>
            <p>
              {confirming === "submit"
                ? "Submission grants no power. It permits a later generation to answer in another vessel."
                : confirming === "destroy"
                  ? "Knowledge remains in the receipt. No inheritance will be authorized from this witness."
                  : "The lineage remains Observed. No progression state changes."}
            </p>
            <div>
              <button type="button" onClick={() => decide(confirming)} autoFocus>
                {confirming.toUpperCase()} CANDIDATE
              </button>
              <button type="button" onClick={() => setConfirming(null)}>RETURN TO EVIDENCE</button>
            </div>
          </footer>
        ) : (
          <footer className="judgment-actions">
            <div>
              <strong>WHAT IS KNOWN IS NOT YET INHERITED.</strong>
              <span>No choice grants a starting item, stat, or canonical lineage.</span>
            </div>
            <nav aria-label="Candidate judgment">
              <button type="button" onClick={() => setConfirming(JUDGMENT_DECISIONS.SUBMIT)}>
                SUBMIT
                <small>release for examination</small>
              </button>
              <button type="button" onClick={() => setConfirming(JUDGMENT_DECISIONS.DEFER)}>
                DEFER
                <small>retain without advancement</small>
              </button>
              <button type="button" onClick={() => setConfirming(JUDGMENT_DECISIONS.DESTROY)}>
                DESTROY
                <small>contain the candidate</small>
              </button>
            </nav>
          </footer>
        )}
      </div>
    </section>
  );
}
