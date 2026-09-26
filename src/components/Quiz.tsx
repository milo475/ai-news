"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startQuizAction } from "@/songolt/actions";
import {
  BUDGETS, BUDGET_LABEL, DEVICES, DEVICE_LABEL, encodeAnswers, MAX_TASKS, MONGOLIAN,
  MONGOLIAN_LABEL, STEPS, TASKS, TASK_LABEL, WHOS, WHO_LABEL,
  type Answers, type Budget, type Device, type MongolianUse, type Task, type Who,
} from "@/songolt/score.api";
import { track } from "@/lib/analytics";

const QUESTIONS = [
  "Юунд ашиглах вэ?",
  "Та хэн бэ?",
  "Төсөв?",
  "Монгол хэлээр хэр их ажиллах вэ?",
  "Ямар төхөөрөмж дээр?",
] as const;

/** Мобайлд хуруугаар дарахад тохиромжтой том товч */
const optionClass = (on: boolean) =>
  `w-full text-left rounded-lg border px-4 py-3.5 text-base transition-colors ${
    on ? "border-accent bg-accent/10 text-accent" : "border-line hover:border-accent/50 hover:bg-line/30"
  }`;

/** 5 асуулт, нэг нэгээр. Сервер рүү зөвхөн эхлэхэд ба дуусахад л хандана. */
export function Quiz() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [who, setWho] = useState<Who | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [mongolian, setMongolian] = useState<MongolianUse | null>(null);
  const [started, setStarted] = useState(false);

  const begin = () => {
    if (started) return;
    setStarted(true);
    track("quiz_start");
    void startQuizAction();
  };

  const next = (to: number) => {
    begin();
    track(`quiz_step_${to + 1}`);
    setStep(to);
  };

  const toggleTask = (t: Task) => {
    begin();
    setTasks((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : prev.length >= MAX_TASKS ? prev : [...prev, t],
    );
  };

  const finish = (device: Device) => {
    const answers: Answers = { tasks, who: who!, budget: budget!, mongolian: mongolian!, device };
    track("quiz_step_5");
    router.push(`/songolt/${encodeAnswers(answers)}`);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span>Асуулт {step + 1} / {STEPS}</span>
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="hover:text-ink">
              ← Буцах
            </button>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-line/60 overflow-hidden" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS}>
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${((step + 1) / STEPS) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{QUESTIONS[step]}</h2>

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Хамгийн ихдээ {MAX_TASKS}-ыг сонгоно уу.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {TASKS.map((t) => (
              <button key={t} type="button" onClick={() => toggleTask(t)} className={optionClass(tasks.includes(t))}>
                {TASK_LABEL[t]}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={tasks.length === 0}
            onClick={() => next(1)}
            className="w-full rounded-lg bg-accent text-white px-4 py-3 font-medium disabled:opacity-50"
          >
            {tasks.length === 0 ? "Дор хаяж нэгийг сонгоно уу" : `Цааш (${tasks.length} сонгосон)`}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="grid sm:grid-cols-2 gap-2">
          {WHOS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => { setWho(w); next(2); }}
              className={optionClass(who === w)}
            >
              {WHO_LABEL[w]}
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          {BUDGETS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => { setBudget(b); next(3); }}
              className={optionClass(budget === b)}
            >
              {BUDGET_LABEL[b]}
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          {MONGOLIAN.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMongolian(m); next(4); }}
              className={optionClass(mongolian === m)}
            >
              {MONGOLIAN_LABEL[m]}
            </button>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2">
          {DEVICES.map((d) => (
            <button key={d} type="button" onClick={() => finish(d)} className={optionClass(false)}>
              {DEVICE_LABEL[d]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
