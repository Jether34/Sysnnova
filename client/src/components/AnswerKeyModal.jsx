import { useState } from "react";
import Modal from "./Modal.jsx";

const CHOICES = ["A", "B", "C", "D", "E"];

export default function AnswerKeyModal({ open, onClose, assessment, onSaved }) {
  const total = assessment?.item || 20;
  const existing = assessment?.answerKey || [];
  const [answers, setAnswers] = useState(() => {
    const arr = [];
    for (let i = 0; i < total; i++) arr.push(existing[i] || "");
    return arr;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (i, val) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
    setError("");
  };

  const fillAll = (val) => {
    setAnswers(Array(total).fill(val));
    setError("");
  };

  const filled = answers.filter((a) => a !== "").length;

  const submit = async () => {
    if (filled !== total) {
      setError(`All ${total} items must have an answer. ${total - filled} remaining.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/assessments/${assessment._id}/answer-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answerKey: answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save answer key.");
      onSaved?.(data.assessment);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open title="Set Answer Key" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Select the correct answer for each item. This key is used by the OMR scanner to auto-grade.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Fill all as:</span>
          {CHOICES.map((c) => (
            <button key={c} type="button" onClick={() => fillAll(c)}
              className="w-8 h-8 rounded-full text-xs font-bold border-2 border-slate-200 text-slate-600 hover:border-primary-400 hover:bg-primary-50 transition">
              {c}
            </button>
          ))}
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="px-3 py-2 text-left w-16">#</th>
                {CHOICES.map((c) => (
                  <th key={c} className="px-2 py-2 text-center w-16">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answers.map((a, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="px-3 py-1.5 font-medium text-slate-700">{i + 1}</td>
                  {CHOICES.map((c) => (
                    <td key={c} className="px-2 py-1.5 text-center">
                      <button type="button" onClick={() => set(i, c)}
                        className={`w-8 h-8 rounded-full text-xs font-bold border-2 transition ${
                          a === c
                            ? "border-primary-600 bg-primary-600 text-white"
                            : "border-slate-200 text-slate-400 hover:border-primary-300"
                        }`}>
                        {c}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400">{filled}/{total} answered</span>
          <div className="flex gap-2">
            <button className="btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-primary" onClick={submit} disabled={busy || filled !== total}>
              {busy ? "Saving..." : "Save Answer Key"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
