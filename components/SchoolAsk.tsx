"use client";

import { useState } from "react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { Button } from "@/components/ui/button";
import type { AskAnswer } from "@/lib/ask";
import { copy } from "@/lib/copy";

const SUGGESTIONS = [
  "What curriculum does this school teach?",
  "What is the student–teacher ratio?",
  "Is the school on the MoE approved list?",
  "What is the tuition fee?",
];

type SchoolAskProps = {
  schoolId: number;
  schoolName: string;
};

export function SchoolAsk({ schoolId, schoolName }: SchoolAskProps) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskAnswer | null>(null);

  async function submit(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) {
      setError(copy.askEmpty);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolId, question: trimmed }),
      });
      const payload = (await response.json()) as AskAnswer & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not answer that question.");
        setResult(null);
        return;
      }
      setResult(payload);
    } catch {
      setError("Could not reach the Q&A service.");
      setResult(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {copy.faqsHelp} Answers stay about {schoolName} only.
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(question);
        }}
      >
        <label className="block text-sm font-medium text-foreground" htmlFor="school-ask">
          {copy.askLabel}
        </label>
        <textarea
          id="school-ask"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={copy.askPlaceholder}
          rows={3}
          maxLength={500}
          className="w-full rounded-lg border border-input bg-white px-3 py-2 text-base text-foreground outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2"
        />
        <Button type="submit" className="h-11 min-w-28 px-5" disabled={pending}>
          {pending ? "Looking up…" : copy.askButton}
        </Button>
      </form>

      <ul className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((item) => (
          <li key={item}>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-muted/50 px-3 text-sm text-primary"
              onClick={() => {
                setQuestion(item);
                void submit(item);
              }}
            >
              {item}
            </button>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="text-sm text-confidence-unknown" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-lg border border-border/80 bg-muted/40 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {result.tier ? (
              <ConfidenceBadge
                compact
                tier={result.tier}
                score={result.score ?? undefined}
              />
            ) : null}
          </div>
          <p className="text-base leading-relaxed text-foreground">{result.answer}</p>
          {result.citations.length > 0 ? (
            <ul className="space-y-2">
              {result.citations.map((citation) => (
                <li
                  key={`${citation.sourceName}-${citation.sourceDate}-${citation.valueText}`}
                  className="text-sm text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{citation.valueText}</span>
                  {" · "}
                  {citation.sourceName}
                  {" · "}
                  {citation.sourceDate}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
