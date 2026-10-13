import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  FileSearch,
  Landmark,
  Loader2,
  PackageSearch,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { seoHead } from "@/lib/seo";
import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";
import { classifyHsProduct, lookupHsCode } from "@/lib/api/hs-classification.functions";
import type { HsClassificationResult } from "@/server/hs-classification";

export const Route = createFileRoute("/customs")({
  head: () =>
    seoHead({
      title: "HS & Customs - Logisight",
      description:
        "상품 정보를 기반으로 HS Code, 관세·FTA, 수입 규제와 Landed Cost를 한 흐름에서 검토합니다.",
      path: "/customs",
      // jaPath 를 두지 않는다 —— 일본판에 /customs 가 없어 404 다(일본판 /hs 는
      // HS 코드 조회라 같은 도구가 아니므로 대응 페이지로 걸 수 없다).
    }),
  component: AiCustomsPage,
});

// 형제 인사이트 페이지와 같은 본문 폭(LogisightRates · LogisightTrade 와 동일)
const WRAP = "mx-auto w-full max-w-[1240px] px-4 min-[640px]:px-7";

// 분석이 도는 동안 무엇을 하고 있는지 그대로 적는다. 실제 파이프라인 순서다
// (analyzeProductForEuCn → searchOfficialEuNomenclatureByHeadings →
//  rankOfficialEuCnCandidates → 관세·원산지·규제 조회).
// 단계별 완료 표시는 하지 않는다 —— 서버가 진행 상황을 알려주지 않으므로
// 체크가 켜지는 연출은 지어낸 진행률이 된다.
const LOADING_STEPS = [
  "제품 설명에서 HS4 범위를 좁힙니다",
  "공식 CN 데이터에서 8자리 후보를 조회합니다",
  "조회된 후보 안에서만 순위를 매깁니다",
  "관세·FTA 원산지·수입 규제를 확인합니다",
];

// 코드 직접 조회 경로. LLM 을 부르지 않아 단계가 짧다.
const CODE_LOADING_STEPS = [
  "입력한 코드가 공식 CN 2026 에 있는지 확인합니다",
  "기본관세와 한-EU FTA 특혜세율을 조회합니다",
  "원산지 기준과 수입 규제를 확인합니다",
];

const STEPS = [
  { label: "HS Classification", icon: PackageSearch },
  { label: "Duty & FTA", icon: Landmark },
  { label: "Compliance", icon: ShieldCheck },
  { label: "Landed Cost", icon: Calculator },
];

function AiCustomsPage() {
  const [product, setProduct] = useState("");
  const [started, setStarted] = useState(false);
  // 입력 방식. 코드를 아는 사람에게 설명을 다시 쓰게 하지 않는다.
  // 목적지 시장. 미국은 HTS 기본세율과 한-미 FTA 특혜세율까지만 있고
  // VAT·원산지기준·수입규제 데이터가 없다(lookup-us-hts-code.ts 참조).
  const [market, setMarket] = useState<"EU" | "US">("EU");
  const [mode, setMode] = useState<"describe" | "code">("describe");
  const [hsCode, setHsCode] = useState("");
  const [loading, setLoading] = useState(false);
  // 10초 넘게 걸리는 작업이라 경과 시간을 보여 준다. 멈춘 것인지 도는 것인지
  // 구분이 안 되면 사용자가 새로고침한다.
  const [elapsed, setElapsed] = useState(0);
  const resultRef = useRef<HTMLElement | null>(null);
  const [result, setResult] = useState<HsClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [destinationCountry, setDestinationCountry] = useState("DE");
  const [productValue, setProductValue] = useState("");
  const [freight, setFreight] = useState("");
  const [insurance, setInsurance] = useState("");
  const [importCosts, setImportCosts] = useState("");
  const VAT: Record<string,string> = { DE:"19",FR:"20",NL:"21",IT:"22",ES:"21",PL:"23",AT:"20",BE:"21",BG:"20",HR:"25",CY:"19",CZ:"21",DK:"25",EE:"24",FI:"25.5",GR:"24",HU:"27",IE:"23",LV:"21",LT:"21",LU:"17",MT:"18",PT:"23",RO:"21",SK:"23",SI:"22",SE:"25" };
  const [vatRate, setVatRate] = useState("19");
  const [preferentialOriginEligible, setPreferentialOriginEligible] = useState(false);
  const [originManufacturedInKr, setOriginManufacturedInKr] = useState("");
  const [originFabricOriginating, setOriginFabricOriginating] = useState("");
  const [originSufficientProcessing, setOriginSufficientProcessing] = useState("");
  const [originKnittingInKr, setOriginKnittingInKr] = useState("");
  const [originSpinningOrExtrusionInKr, setOriginSpinningOrExtrusionInKr] = useState("");
  const [originMakingUpInKr, setOriginMakingUpInKr] = useState("");
  const [originExWorksPrice, setOriginExWorksPrice] = useState("");
  const [originNonOriginValue, setOriginNonOriginValue] = useState("");
  const [originNonOriginHs4, setOriginNonOriginHs4] = useState("");
  const [originNonOriginHs6, setOriginNonOriginHs6] = useState("");
  const [originWhollyObtained, setOriginWhollyObtained] = useState("");

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [loading]);

  const analyze = async () => {
    const ready = mode === "code" ? hsCode.replace(/[^0-9]/g, "").length >= 4 : product.trim().length > 0;
    if (!ready || loading) return;
    setStarted(true);
    setLoading(true);
    // 결과 영역이 입력 폼 아래 있어서, 버튼을 누른 자리에서는 화면 밖이었다.
    // 아무 일도 안 일어난 것처럼 보이던 가장 큰 이유다.
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    setResult(null);
    setError(null);
    try {
      // 두 경로가 같은 부가 입력(원가·원산지 판정)을 쓴다. 공통부를 한 번만 만든다.
      const payload = {
        originCountry: "KR" as const, destinationMarket: market,
        destinationCountry,
        ...(productValue ? { productValue: Number(productValue) } : {}),
        ...(freight ? { freight: Number(freight) } : {}),
        ...(insurance ? { insurance: Number(insurance) } : {}),
        ...(importCosts ? { importCosts: Number(importCosts) } : {}),
        ...(vatRate ? { vatRate: Number(vatRate) } : {}),
        preferentialOriginEligible,
        ...(originManufacturedInKr ? { originManufacturedInKr: originManufacturedInKr === "yes" } : {}),
        ...(originFabricOriginating ? { originFabricOriginating: originFabricOriginating === "yes" } : {}),
        ...(originSufficientProcessing ? { originSufficientProcessing: originSufficientProcessing === "yes" } : {}),
        ...(originKnittingInKr ? { originKnittingInKr: originKnittingInKr === "yes" } : {}),
        ...(originSpinningOrExtrusionInKr ? { originSpinningOrExtrusionInKr: originSpinningOrExtrusionInKr === "yes" } : {}),
        ...(originMakingUpInKr ? { originMakingUpInKr: originMakingUpInKr === "yes" } : {}),
        ...(originExWorksPrice ? { originExWorksPrice: Number(originExWorksPrice) } : {}),
        ...(originNonOriginValue ? { originNonOriginatingMaterialValue: Number(originNonOriginValue) } : {}),
        ...(originNonOriginHs4.trim() ? { originNonOriginatingMaterialHs4: originNonOriginHs4.split(",").map(x=>x.trim()).filter(x=>/^\d{4}$/.test(x)) } : {}),
        ...(originNonOriginHs6.trim() ? { originNonOriginatingMaterialHs6: originNonOriginHs6.split(",").map(x=>x.trim()).filter(x=>/^\d{6}$/.test(x)) } : {}),
        ...(originWhollyObtained ? { originWhollyObtained: originWhollyObtained === "yes" } : {}),
      };
      const response = mode === "code"
        ? await lookupHsCode({ data: { cnCode: hsCode, ...payload } })
        : await classifyHsProduct({ data: { description: product.trim(), ...payload } });
      setResult(response);
    } catch (cause) {
      console.error(cause);
      setError("HS 분류 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* 헤더·푸터를 이 페이지가 직접 그린다 ★
       형제 인사이트 페이지(/rates · /trade · /dashboard …)는 모두 다크 HomeNav +
       InsightSubNav + HomeFooter 를 자기가 그리고, __root 의 전역 Navigation 을
       받지 않는다. /customs 만 그 목록에서 빠져 있어 밝은 버전 Navigation 이
       붙었고, 그래서 헤더만 혼자 달라 보였다. 같은 구성으로 맞춘다. */
    <div className="min-h-screen bg-[#070b16]">
      <HomeNav active="insight" />
      <InsightSubNav />

      <section className="relative overflow-hidden bg-[#070b16]">
        <div className={WRAP}>
          <div className="max-w-[760px] pb-[64px] pt-[54px]">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2dd4bf]">
              HS &amp; Customs
            </span>
            <h1 className="mt-3.5 text-[clamp(32px,4.4vw,50px)] font-extrabold leading-[1.06] tracking-[-0.035em] text-[#e9eef7]">
              관세 · <span className="text-[#2dd4bf]">HS 분류</span>
            </h1>
            <p className="mt-4 max-w-[600px] text-[15px] leading-[1.6] text-[#93a1b7]">
              제품 하나로 HS 분류부터 관세·FTA, 수입 규제, 예상 Landed Cost까지 검토합니다.
              한국에서 EU로 수출하는 시나리오를 기준으로 합니다.
            </p>
            <div className="mt-[22px] flex flex-wrap gap-2.5">
              {STEPS.map(({ label, icon: Icon }, index) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-[#78a0cd1c] bg-[#0e1626] px-[13px] py-[7px] text-[12.5px] text-[#93a1b7]"
                >
                  <span className="lsg-mono text-[#2dd4bf]">{index + 1}</span>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 본문은 밝은 바닥 위에 올린다 —— 형제 페이지와 같은 겹침 처리 */}
      <div
        className="relative z-[2] -mt-7 rounded-t-[28px] bg-[#e6eaf1] pb-2.5"
        style={{ boxShadow: "0 -24px 60px -34px rgba(0,0,0,.7)" }}
      >
      <main className={`${WRAP} py-10`}>
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
            <div className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              <h2 className="text-lg font-semibold">상품 분석</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              상품의 용도, 재질·성분, 형태를 구체적으로 입력할수록 분류 정확도가 높아집니다.
            </p>
            {/* 결과 안쪽 경고는 분류에 대한 것이고, 세액은 돈이 걸린 조언이다.
                공개 도구가 되는 이상 실행 전에도 보이는 자리에 둔다. */}
            <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
              참고용입니다. HS 분류와 세액은 수입통관 시 세관이 확정하며, 결과는 공식
              CN·관세 데이터에 근거한 검토 자료일 뿐 유권해석이 아닙니다. 종량세·복합세율과
              회원국별 VAT 과세표준 차이는 자동 계산에 반영되지 않습니다.
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
                  value={market}
                  onChange={(event) => {
                    const next = event.target.value as "EU" | "US";
                    setMarket(next);
                    // 미국은 아직 코드 조회만 된다 —— AI 분류는 EU CN 기준으로
                    // 만들어져 있어 HTS 후보를 내놓지 못한다.
                    if (next === "US") setMode("code");
                    setStarted(false);
                    setResult(null);
                    setError(null);
                  }}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="EU">European Union</option>
                  <option value="US">United States</option>
                </select>
              </Field>
            </div>

            {/* 입력 방식 ★
                HS 코드는 인보이스·수출신고필증에 이미 적혀 있는 경우가 많다.
                코드를 아는 사람에게 설명을 다시 쓰게 하고 LLM 두 번(9.6~11.6초)을
                기다리게 할 이유가 없다. 코드 경로는 DB 조회만 해서 1초대다. */}
            <div className="mt-5 flex gap-0 rounded-md border border-input p-1">
              {(market === "US"
                ? ([["code", "HTS 코드로 조회"]] as const)
                : ([
                    ["describe", "제품 설명으로 분류"],
                    ["code", "HS 코드로 바로 조회"],
                  ] as const)
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setStarted(false);
                    setResult(null);
                    setError(null);
                  }}
                  className={`flex-1 rounded px-3 py-2 text-sm transition ${
                    mode === value ? "bg-foreground font-semibold text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {market === "US" && (
              <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-foreground">
                미국은 <strong>기본세율(MFN)과 한-미 FTA 특혜세율</strong>만 조회합니다.
                232조·301조 등 <strong>추가관세는 포함되지 않습니다</strong> —— 품목·원산지에 따라
                기본세율 위에 더 붙을 수 있으니 반드시 별도로 확인하세요. 수입 규제와
                원산지 자동판정은 아직 지원하지 않습니다.
              </p>
            )}

            {mode === "code" ? (
              <Field label={market === "US" ? "HTS 코드" : "HS / CN 코드"} className="mt-5">
                <input
                  value={hsCode}
                  onChange={(event) => {
                    setHsCode(event.target.value);
                    setStarted(false);
                    setResult(null);
                    setError(null);
                  }}
                  inputMode="numeric"
                  placeholder={market === "US" ? "예: 8507.60.00.10 또는 8507600010" : "예: 8507.60.00 또는 85076000"}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 font-mono text-sm outline-none transition focus:border-foreground/40"
                />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  점·공백은 넣어도 됩니다. 짧게 넣으면 하위 코드를 골라 보여 줍니다.
                  {market === "US"
                    ? " 미국 HTS 는 10자리이며, 세율은 세번 단위로 정해집니다."
                    : " EU CN 은 8자리이며, 관세율도 8자리 단위로 정해집니다."}
                  {" "}이 경로는 AI 분류를 거치지 않고, 입력한 코드가 공식 데이터에 있는지만
                  확인한 뒤 세율을 조회합니다.
                </p>
              </Field>
            ) : (
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
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {market === "EU" && <Field label="EU destination">
                <select value={destinationCountry} onChange={(e) => { setDestinationCountry(e.target.value); setVatRate(VAT[e.target.value] ?? ""); }} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="DE">Germany</option><option value="FR">France</option><option value="NL">Netherlands</option><option value="IT">Italy</option><option value="ES">Spain</option><option value="PL">Poland</option><option value="AT">Austria</option><option value="BE">Belgium</option><option value="BG">Bulgaria</option><option value="HR">Croatia</option><option value="CY">Cyprus</option><option value="CZ">Czechia</option><option value="DK">Denmark</option><option value="EE">Estonia</option><option value="FI">Finland</option><option value="GR">Greece</option><option value="HU">Hungary</option><option value="IE">Ireland</option><option value="LV">Latvia</option><option value="LT">Lithuania</option><option value="LU">Luxembourg</option><option value="MT">Malta</option><option value="PT">Portugal</option><option value="RO">Romania</option><option value="SK">Slovakia</option><option value="SI">Slovenia</option><option value="SE">Sweden</option>
                </select>
              </Field>}
              {market === "EU" && <Field label="VAT rate (%)"><input value={vatRate} onChange={(e)=>setVatRate(e.target.value)} type="number" min="0" step="0.1" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" /></Field>}
              <Field label="Product value (EUR)"><input value={productValue} onChange={(e)=>setProductValue(e.target.value)} type="number" min="0" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" /></Field>
              <Field label="Freight (EUR)"><input value={freight} onChange={(e)=>setFreight(e.target.value)} type="number" min="0" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" /></Field>
              <Field label="Insurance (EUR)"><input value={insurance} onChange={(e)=>setInsurance(e.target.value)} type="number" min="0" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" /></Field>
              <Field label="Import / incidental costs (EUR)"><input value={importCosts} onChange={(e)=>setImportCosts(e.target.value)} type="number" min="0" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" /></Field>
              {market === "EU" && <details className="rounded-md border border-border p-4 sm:col-span-2">
                <summary className="cursor-pointer text-sm font-semibold">한-EU FTA 원산지 판정 상세 입력 (선택)</summary>
                <p className="mt-2 text-xs text-muted-foreground">먼저 상품명만으로 분석할 수 있습니다. FTA 특혜세율 자동판정이 필요할 때만 아래 정보를 입력하세요.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="한국에서 최종 생산"><select value={originManufacturedInKr} onChange={e=>setOriginManufacturedInKr(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">미확인</option><option value="yes">예</option><option value="no">아니오</option></select></Field>
                  <Field label="투입 원단이 한-EU FTA 원산지"><select value={originFabricOriginating} onChange={e=>setOriginFabricOriginating(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">미확인</option><option value="yes">예</option><option value="no">아니오</option></select></Field>
                  <Field label="한국 내 충분가공"><select value={originSufficientProcessing} onChange={e=>setOriginSufficientProcessing(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">미확인</option><option value="yes">예</option><option value="no">아니오</option></select></Field>
                  <Field label="한국 내 편직"><select value={originKnittingInKr} onChange={e=>setOriginKnittingInKr(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">미확인</option><option value="yes">예</option><option value="no">아니오</option></select></Field>
                  <Field label="한국 내 방적 또는 필라멘트사 압출"><select value={originSpinningOrExtrusionInKr} onChange={e=>setOriginSpinningOrExtrusionInKr(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">미확인</option><option value="yes">예</option><option value="no">아니오</option></select></Field>
                  <Field label="한국 내 재단·봉제·조립"><select value={originMakingUpInKr} onChange={e=>setOriginMakingUpInKr(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">미확인</option><option value="yes">예</option><option value="no">아니오</option></select></Field>
                  <Field label="공장도가격 (EUR)"><input value={originExWorksPrice} onChange={e=>setOriginExWorksPrice(e.target.value)} type="number" min="0" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"/></Field>
                  <Field label="비원산지재료 가격 (EUR)"><input value={originNonOriginValue} onChange={e=>setOriginNonOriginValue(e.target.value)} type="number" min="0" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"/></Field>
                  <Field label="비원산지 원재료 HS4 (쉼표 구분)"><input value={originNonOriginHs4} onChange={e=>setOriginNonOriginHs4(e.target.value)} placeholder="예: 3901, 3902" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"/></Field>
                  <Field label="비원산지 원재료 HS6 (쉼표 구분)"><input value={originNonOriginHs6} onChange={e=>setOriginNonOriginHs6(e.target.value)} placeholder="예: 390110, 390120" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"/></Field>
                  <Field label="완전생산 여부"><select value={originWhollyObtained} onChange={e=>setOriginWhollyObtained(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">미확인</option><option value="yes">예</option><option value="no">아니오</option></select></Field>
                </div>
                <label className="mt-3 flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={preferentialOriginEligible} onChange={(e)=>setPreferentialOriginEligible(e.target.checked)} className="mt-1" />
                  <span><strong>유효한 한-EU FTA 원산지 신고/증빙 보유</strong><br/><span className="text-xs text-muted-foreground">자동 PSR 판정이 충족이고 이 항목도 확인된 경우에만 특혜세율을 Landed Cost에 적용합니다.</span></span>
                </label>
              </details>}
            </div>

            <button
              type="button"
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={(mode === "code" ? hsCode.replace(/[^0-9]/g, "").length < 4 : !product.trim()) || loading}
              onClick={analyze}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  분석 중…
                </>
              ) : (
                <>
                  {mode === "code" ? "관세 조회" : "Analyze Product"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
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

        <section ref={resultRef} className="mt-8 scroll-mt-24">
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
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">
                {mode === "code" ? "공식 CN 데이터에서 조회하고 있습니다" : "공식 EU CN 후보를 분석하고 있습니다"}
              </h2>
              <p className="mt-1.5 text-sm tabular-nums text-muted-foreground">
                {elapsed}초 경과 · 보통 {mode === "code" ? "1~2초" : "10~15초"} 걸립니다
              </p>
              <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-sm text-muted-foreground">
                {(mode === "code" ? CODE_LOADING_STEPS : LOADING_STEPS).map((step) => (
                  <li key={step} className="flex gap-2">
                    <span className="text-muted-foreground/60">·</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-card px-6 py-8">
              <h2 className="font-semibold">분석 오류</h2>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </div>
          ) : result ? (
            <AnalysisResult result={result} preferentialOriginEligible={preferentialOriginEligible} />
          ) : (
            <AnalysisSkeleton />
          )}
        </section>
      </main>
      </div>

      <HomeFooter />
    </div>
  );
}

function AnalysisResult({ result, preferentialOriginEligible }: { result: HsClassificationResult; preferentialOriginEligible: boolean }) {
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
            {candidate.evidence.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Official evidence</p>
                <div className="mt-2 space-y-2">
                  {candidate.evidence.map((item) => (
                    <a key={item.type} href={item.url} target="_blank" rel="noreferrer" className="block rounded-md border border-border p-3 hover:bg-muted/40">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{item.status === "matched" ? "확인됨" : "추가 확인"}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.note}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}</div> : (
          /* 보류 화면을 막다른 길에서 분기점으로 ★
             전에는 문장 한 줄과 질문 목록이 전부였다. 10초를 기다려 빈 카드를 받는
             꼴이었는데, 정작 서버는 (1) 제품을 어떻게 이해했는지와 (2) 범위 안의
             공식 CN 후보를 손에 쥐고 있으면서 둘 다 버리고 있었다. 고르지는 않되
             —— 그게 이 도구의 안전장치다 —— 판단에 필요한 재료는 내놓는다. */
          <div className="mt-5 space-y-5">
            <p className="text-sm text-muted-foreground">현재 정보만으로 공식 CN 후보를 확정하지 않았습니다.</p>

            {(result.normalizedProduct.name || result.normalizedProduct.intendedUse) && (
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground">이렇게 이해했습니다 — 틀렸다면 설명을 고쳐 주세요</p>
                <dl className="mt-2 space-y-1 text-sm">
                  {([
                    ["품명", result.normalizedProduct.name],
                    ["재질", result.normalizedProduct.material],
                    ["조성", result.normalizedProduct.composition],
                    ["용도", result.normalizedProduct.intendedUse],
                    ["형태", result.normalizedProduct.form],
                  ] as const).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="w-10 flex-none text-muted-foreground">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {result.followUpQuestions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">이 질문에 답하면 코드가 좁혀집니다</p>
                {result.followUpQuestions.map((q) => <p key={q} className="mt-2 text-sm font-medium">{q}</p>)}
              </div>
            )}

            {result.undecidedCandidates && result.undecidedCandidates.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  구분이 필요한 공식 CN 후보 — 아직 고르지 않았습니다
                </p>
                <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                  {result.undecidedCandidates.map((x) => (
                    <li key={x.code} className="flex gap-3 px-3 py-2 text-sm">
                      <span className="flex-none font-mono text-xs leading-5 text-muted-foreground">{x.code}</span>
                      <span className="leading-5">{x.description}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  위 질문들은 이 후보들을 가르는 기준입니다. 추천이 아니라 범위입니다.
                </p>
              </div>
            )}
          </div>
        )}
        {result.warnings.map((warning) => <p key={warning} className="mt-3 text-xs leading-5 text-muted-foreground">{warning}</p>)}
      </article>
      <div className="space-y-4">
        <ResultCard number="02" title="Duty & FTA" status={result.customs?.duty.status === "available" ? "데이터 확인" : "데이터 적재 필요"}>
          {result.customs?.duty.status === "available" ? (
            <div className="space-y-2 text-sm">
              {/* % 가 없으면 원문을 보여준다 —— 종량세·복합세율이라 null 인 것이지 모르는 게 아니다 */}
              <p>EU 기본관세: <strong>{result.customs.duty.thirdCountryRate == null ? (result.customs.duty.thirdCountryRateText ?? "—") : `${result.customs.duty.thirdCountryRate}%`}</strong></p>
              <p>한국산 협정/특혜세율: <strong>{result.customs.duty.preferentialRate == null ? (result.customs.duty.preferentialRateText ?? (result.customs.duty.thirdCountryRate === 0 ? "별도 혜택 불필요" : "확인 필요")) : `${result.customs.duty.preferentialRate}%`}</strong></p>
              {result.customs.duty.preferentialRate != null && <p>실제 계산 적용: <strong>{preferentialOriginEligible && result.customs.originAssessment?.status === "qualified" ? "FTA 특혜세율" : "EU 기본관세"}</strong></p>}
              {result.customs.duty.thirdCountryRate === 0 && result.customs.duty.preferentialRate == null ? (
                <div className="mt-3 rounded-md border border-border p-3 text-xs text-muted-foreground">
                  EU 기본관세가 이미 0%이므로 관세 절감을 위한 FTA 원산지 판정은 필요하지 않습니다.
                </div>
              ) : result.customs.originAssessment && <div className="mt-3 rounded-md border border-border p-3">
                <p className="font-medium">원산지 자동판정: {result.customs.originAssessment.status === "qualified" ? "충족" : result.customs.originAssessment.status === "not_qualified" ? "불충족" : result.customs.originAssessment.status === "needs_information" ? "추가정보 필요" : "PSR 데이터 준비 필요"}</p>
                {result.customs.originAssessment.ruleCode && <p className="mt-1 text-xs text-muted-foreground">적용 기준: {result.customs.originAssessment.ruleCode}</p>}
                {result.customs.originAssessment.ruleTextKo && <p className="mt-1 text-xs leading-5 text-muted-foreground">{result.customs.originAssessment.ruleTextKo}</p>}
                {result.customs.originAssessment.checks.map(x=><p key={x} className="mt-1 text-xs">{x}</p>)}
                {result.customs.originAssessment.missingInputs.length>0 && <p className="mt-1 text-xs text-muted-foreground">필요정보: {result.customs.originAssessment.missingInputs.join(", ")}</p>}
              </div>}
              {result.customs.duty.notes.map((note) => <p key={note} className="text-xs text-muted-foreground">{note}</p>)}
            </div>
          ) : <p className="text-sm text-muted-foreground">{result.customs?.duty.notes[0] ?? "공식 관세 데이터를 준비 중입니다."}</p>}
        </ResultCard>
        <ResultCard number="03" title="Certification & Regulation" status={result.customs?.regulation.status === "guidance" ? "규제 가이드" : "추가 확인"}>
          <div className="space-y-3">{result.customs?.regulation.items.map((item) => <a key={item.title} href={item.url} target="_blank" rel="noreferrer" className="block rounded-md border border-border p-3 hover:bg-muted/40"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></a>)}</div>
        </ResultCard>
        <ResultCard number="04" title="Estimated Landed Cost" status={result.customs?.landedCost.status === "ready" ? "계산 완료" : "입력 필요"}>
          <p className="text-sm text-muted-foreground">{result.customs?.landedCost.formula}</p>
          {result.customs?.landedCost.status === "ready" ? <div className="mt-3 space-y-1 text-sm"><p>관세평가액: <strong>€{result.customs.landedCost.customsValue?.toFixed(2)}</strong></p><p>관세: <strong>€{result.customs.landedCost.dutyAmount?.toFixed(2)}</strong></p><p>수입부대비용: <strong>€{(result.customs.landedCost.importCosts ?? 0).toFixed(2)}</strong></p><p>VAT: <strong>€{result.customs.landedCost.vatAmount?.toFixed(2)}</strong></p><p className="pt-1">예상 수입원가: <strong>€{result.customs.landedCost.estimatedTotal?.toFixed(2)}</strong></p></div> : <p className="mt-2 text-xs text-muted-foreground">필요 입력/데이터: {result.customs?.landedCost.missingInputs.join(", ")}</p>}
        </ResultCard>
      </div>
    </div>
  );
}
function ResultCard({ number, title, status, children }: { number: string; title: string; status: string; children: React.ReactNode }) {
 return <article className="rounded-xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-semibold text-muted-foreground">{number}</span><h3 className="mt-1 font-semibold">{title}</h3></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{status}</span></div><div className="mt-4">{children}</div></article>;
}

function AnalysisSkeleton() {
  const sections = [
    ["01", "HS Classification", "공식 HS 데이터 및 분류 엔진 연결 필요"],
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
