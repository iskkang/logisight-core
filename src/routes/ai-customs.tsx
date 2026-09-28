import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  FileSearch,
  Landmark,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

import { seoHead } from "@/lib/seo";
import { classifyHsProduct } from "@/lib/api/hs-classification.functions";
import type { HsClassificationResult } from "@/server/hs-classification";

export const Route = createFileRoute("/ai-customs")({
  head: () =>
    seoHead({
      title: "AI HS & Customs - Logisight",
      description:
        "상품 정보를 기반으로 HS Code, 관세·FTA, 수입 규제와 Landed Cost를 한 흐름에서 검토합니다.",
      path: "/ai-customs",
      jaPath: "/ai-customs",
    }),
  component: AiCustomsPage,
});

const STEPS = [
  { label: "HS Classification", icon: PackageSearch },
  { label: "Duty & FTA", icon: Landmark },
  { label: "Compliance", icon: ShieldCheck },
  { label: "Landed Cost", icon: Calculator },
];

function AiCustomsPage() {
  const [product, setProduct] = useState("");
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HsClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!product.trim() || loading) return;
    setStarted(true);
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await classifyHsProduct({ data: { description: product.trim(), originCountry: "KR", destinationMarket: "EU" } });
      setResult(response);
    } catch (cause) {
      console.error(cause);
      setError("HS 분류 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Logisight Intelligence
          </div>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            AI HS & Customs
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            제품 하나로 HS 분류부터 관세·FTA, 수입 규제, 예상 Landed Cost까지 검토합니다.
            첫 버전은 한국에서 EU로 수출하는 시나리오를 기준으로 설계합니다.
          </p>

          <div className="mt-8 grid gap-2 sm:grid-cols-4">
            {STEPS.map(({ label, icon: Icon }, index) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {index + 1}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
            <div className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              <h2 className="text-lg font-semibold">상품 분석</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              상품의 용도, 재질·성분, 형태를 구체적으로 입력할수록 분류 정확도가 높아집니다.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="From">
                <select
                  disabled
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-100"
                  defaultValue="KR"
                >
                  <option value="KR">South Korea</option>
                </select>
              </Field>
              <Field label="To">
                <select
                  disabled
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-100"
                  defaultValue="EU"
                >
                  <option value="EU">European Union</option>
                </select>
              </Field>
            </div>

            <Field label="Product description" className="mt-5">
              <textarea
                value={product}
                onChange={(event) => {
                  setProduct(event.target.value);
                  setStarted(false);
                  setResult(null);
                  setError(null);
                }}
                rows={6}
                placeholder="예: Facial skin care serum, 50 ml. Main ingredients: niacinamide 10%, hyaluronic acid. Retail cosmetic product for moisturizing and skin care."
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-3 text-sm leading-6 outline-none transition focus:border-foreground/40"
              />
            </Field>

            <button
              type="button"
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!product.trim() || loading}
              onClick={analyze}
            >
              {loading ? "Analyzing..." : "Analyze Product"}
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />
              Invoice / Packing List / 제품 이미지 업로드는 다음 단계에서 연결
            </div>
          </section>

          <aside className="rounded-xl border border-border bg-card p-5 sm:p-7">
            <h2 className="text-lg font-semibold">분석 원칙</h2>
            <div className="mt-5 space-y-5">
              <Principle
                icon={BadgeCheck}
                title="근거 기반 분류"
                text="HS 후보와 분류 근거를 함께 제시하고, 불확실하면 추가 정보가 필요한 항목을 명시합니다."
              />
              <Principle
                icon={ShieldCheck}
                title="확정값과 추정값 분리"
                text="공식 데이터가 연결되지 않은 관세·세금·규제 수치는 임의로 생성하지 않습니다."
              />
              <Principle
                icon={Calculator}
                title="Landed Cost까지 연결"
                text="관세 데이터와 물류비가 연결되면 상품가부터 최종 도착원가까지 한 화면에서 계산합니다."
              />
            </div>
          </aside>
        </div>

        <section className="mt-8">
          {!started ? (
            <div className="rounded-xl border border-border bg-muted/20 px-6 py-12 text-center">
              <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">상품 정보를 입력해 분석을 시작하세요</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                현재 프로토타입은 분석 결과의 정보 구조를 검증하는 단계입니다. 실제 HS·관세·FTA
                데이터 소스는 다음 개발 단계에서 연결합니다.
              </p>
            </div>
          ) : loading ? (
            <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
              <PackageSearch className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">공식 EU CN 후보를 분석하고 있습니다</h2>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-card px-6 py-8">
              <h2 className="font-semibold">분석 오류</h2>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </div>
          ) : result ? (
            <AnalysisResult result={result} />
          ) : (
            <AnalysisSkeleton />
          )}
        </section>
      </main>
    </div>
  );
}

function AnalysisResult({ result }: { result: HsClassificationResult }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <article className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div><span className="text-xs font-semibold text-muted-foreground">01</span><h3 className="mt-1 text-lg font-semibold">HS Classification</h3></div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{result.status === "candidate" ? "공식 CN 후보" : "추가정보 필요"}</span>
        </div>
        {result.candidates.length > 0 ? <div className="mt-5 space-y-4">{result.candidates.map((candidate) => (
          <div key={candidate.heading} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-3"><strong>{candidate.heading}</strong></div>
            <ul className="mt-3 space-y-1 text-sm leading-6 text-muted-foreground">{candidate.rationale.map((line) => <li key={line}>• {line}</li>)}</ul>
          </div>
        ))}</div> : <div className="mt-5"><p className="text-sm text-muted-foreground">현재 정보만으로 공식 CN 후보를 확정하지 않았습니다.</p>{result.followUpQuestions.map((q) => <p key={q} className="mt-2 text-sm font-medium">{q}</p>)}</div>}
        {result.warnings.map((warning) => <p key={warning} className="mt-3 text-xs leading-5 text-muted-foreground">{warning}</p>)}
      </article>
      <div className="space-y-4"><PendingCard number="02" title="Duty & FTA" text="공식 관세율·협정세율 데이터 연결 필요" /><PendingCard number="03" title="Certification & Regulation" text="EU 품목별 규제 데이터 연결 필요" /><PendingCard number="04" title="Estimated Landed Cost" text="관세·세금·운임 데이터 연결 후 계산 가능" /></div>
    </div>
  );
}
function PendingCard({ number, title, text }: { number: string; title: string; text: string }) {
 return <article className="rounded-xl border border-border bg-card p-5"><span className="text-xs font-semibold text-muted-foreground">{number}</span><h3 className="mt-1 font-semibold">{title}</h3><p className="mt-3 text-sm text-muted-foreground">{text}</p></article>;
}

function AnalysisSkeleton() {
  const sections = [
    ["01", "HS Classification", "공식 HS 데이터 및 AI 분류 엔진 연결 필요"],
    ["02", "Duty & FTA", "공식 관세율·협정세율 데이터 연결 필요"],
    ["03", "Certification & Regulation", "EU 품목별 규제 데이터 연결 필요"],
    ["04", "Estimated Landed Cost", "관세·세금·운임 데이터 연결 후 계산 가능"],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sections.map(([number, title, status]) => (
        <article key={title} className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground">{number}</span>
              <h3 className="mt-1 text-lg font-semibold">{title}</h3>
            </div>
            <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              데이터 준비 중
            </span>
          </div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">{status}</p>
        </article>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Principle({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof BadgeCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
