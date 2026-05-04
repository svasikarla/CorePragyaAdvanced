"use client";

import type { TradeoffMatrix as TradeoffMatrixType } from "@/types/tech-research";
import { Trophy, Medal } from "lucide-react";

interface Props {
  matrix: TradeoffMatrixType;
}

const CRITERIA_LABELS: Record<string, string> = {
  performance: "Perf",
  developer_experience: "DX",
  maturity: "Maturity",
  cost: "Cost",
  security: "Security",
};

function ScoreCell({ score }: { score: number }) {
  const color =
    score >= 4
      ? "text-green-700 bg-green-50"
      : score >= 3
      ? "text-amber-700 bg-amber-50"
      : score >= 1
      ? "text-red-700 bg-red-50"
      : "text-slate-400 bg-slate-50";
  return (
    <span className={`inline-block w-8 text-center rounded px-1 py-0.5 text-xs font-semibold ${color}`}>
      {score > 0 ? score : "—"}
    </span>
  );
}

export function TradeoffMatrix({ matrix }: Props) {
  const criteriaKeys = Object.keys(matrix.criteria_weights);
  const maxScore = Math.max(...matrix.rows.map((r) => r.weighted_total));

  return (
    <div className="space-y-4">
      {/* Verdict bar */}
      <div className="flex items-center gap-4 rounded-xl bg-sky-50 border border-sky-200 px-4 py-3">
        <Trophy className="h-5 w-5 text-sky-500 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-sky-700">
            Recommended: {matrix.winner}
          </div>
          <div className="text-xs text-sky-600 mt-0.5">
            Runner-up: {matrix.runner_up} &nbsp;|&nbsp; Confidence:{" "}
            <span className="capitalize font-medium">{matrix.confidence}</span>
          </div>
        </div>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-700 w-10">
                #
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-700">
                Candidate
              </th>
              {criteriaKeys.map((k) => (
                <th key={k} className="text-center px-2 py-2.5 font-semibold text-slate-600 text-xs">
                  <div>{CRITERIA_LABELS[k] ?? k}</div>
                  <div className="text-slate-400 font-normal">
                    w={matrix.criteria_weights[k as keyof typeof matrix.criteria_weights]}
                  </div>
                </th>
              ))}
              <th className="text-center px-4 py-2.5 font-semibold text-slate-700">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              const isWinner = row.candidate === matrix.winner;
              const barWidth = maxScore > 0 ? (row.weighted_total / maxScore) * 100 : 0;
              return (
                <tr
                  key={row.candidate}
                  className={`border-b border-slate-100 last:border-0 ${
                    isWinner ? "bg-sky-50/60" : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <td className="px-4 py-2.5 text-center">
                    {row.rank === 1 ? (
                      <Trophy className="h-4 w-4 text-amber-500 inline" />
                    ) : row.rank === 2 ? (
                      <Medal className="h-4 w-4 text-slate-400 inline" />
                    ) : (
                      <span className="text-slate-400 text-xs">{row.rank}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-medium ${isWinner ? "text-sky-700" : "text-slate-800"}`}>
                      {row.candidate}
                    </span>
                  </td>
                  {criteriaKeys.map((k) => (
                    <td key={k} className="px-2 py-2.5 text-center">
                      <ScoreCell
                        score={row.scores[k as keyof typeof row.scores] ?? 0}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                        <div
                          className={`h-full rounded-full ${isWinner ? "bg-sky-500" : "bg-slate-300"}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold w-8 text-right ${isWinner ? "text-sky-700" : "text-slate-700"}`}>
                        {row.weighted_total}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Key differentiators */}
      {matrix.key_differentiators.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Key Differentiators
          </div>
          <ul className="space-y-1">
            {matrix.key_differentiators.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Non-obvious trade-offs */}
      {matrix.non_obvious_tradeoffs.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Non-obvious Trade-offs
          </div>
          <ul className="space-y-1">
            {matrix.non_obvious_tradeoffs.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 rounded px-3 py-1.5">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
