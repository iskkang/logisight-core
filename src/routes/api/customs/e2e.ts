import { createFileRoute } from "@tanstack/react-router";
import { hsClassificationInputSchema } from "@/server/hs-classification";
import { classifyHsProductCore } from "@/server/classify-hs-core";

const CASES=[
 {id:"cosmetic",description:"Niacinamide 10% facial serum, 50 ml retail bottle, cosmetic skin-care product, no therapeutic claims",expectedHs4:"3304",regulationKeyword:"Cosmetic"},
 {id:"apparel",description:"Men's woven shirt, 100% cotton, retail garment, not knitted",expectedHs4:"6205"},
 {id:"earphones",description:"Bluetooth wireless stereo earphones with charging case, retail set",expectedHs4:"8518"},
 {id:"battery",description:"Rechargeable lithium-ion battery pack, 100 Wh, for portable electronic equipment",expectedHs4:"8507"},
 {id:"coffee",description:"Roasted coffee beans, not decaffeinated, 1 kg retail bag for human consumption",expectedHs4:"0901"},
 {id:"syringe",description:"Sterile disposable plastic medical syringe, without needle, for clinical use",expectedHs4:"9018"},
 {id:"brake-pad",description:"Mounted automotive brake pad set for disc brakes of passenger motor vehicles",expectedHs4:"8708"},
 {id:"water-pump",description:"Centrifugal electric water pump for industrial liquid transfer",expectedHs4:"8413"}
];

export const Route=createFileRoute("/api/customs/e2e")({server:{handlers:{POST:async({request})=>{
 const secret=process.env.E2E_TEST_SECRET;
 if(!secret||request.headers.get("x-e2e-secret")!==secret) return new Response("Unauthorized",{status:401});
 const results=[];
 for(const c of CASES){
   const input=hsClassificationInputSchema.parse({description:c.description,originCountry:"KR",destinationMarket:"EU",destinationCountry:"DE",productValue:1000,freight:100,insurance:10});
   try{
    const out=await classifyHsProductCore(input);
    const top=out.candidates[0]?.heading.match(/^([0-9]{8})/)?.[1]??null;
    const checks={
      returnedCandidate:out.status==="candidate"&&!!top,
      expectedHs4:!!top&&top.startsWith(c.expectedHs4),
      officialCn:out.candidates[0]?.sourceStatus==="officially_verified",
      dutyResolved:out.customs?.duty.status==="available",
      landedCostReady:out.customs?.landedCost.status==="ready",
      regulationResolved:c.regulationKeyword?!!out.customs?.regulation.items.some(x=>x.title.includes(c.regulationKeyword)):true,
      quarantinedEvidenceAbsent:!out.candidates.some(x=>x.evidence.some(e=>e.note.includes("1179/2009")&&c.id==="cosmetic")),
    };
    // 실패했을 때 어느 지점에서 멈췄는지 알 수 있게 진단 필드를 함께 싣는다.
   // methodology 가 두 분기를 구분한다 —— 공식 CN 후보를 못 찾은 것인지("official CN8
   // retrieval" 에서 끝남), 후보는 있는데 순위산정이 보류한 것인지("abstained").
   // warnings 에는 보류 분기에서 모델이 댄 이유(rationaleKo)가 들어 있다.
   results.push({id:c.id,expectedHs4:c.expectedHs4,topCn8:top,status:out.status,checks,pass:Object.values(checks).every(Boolean),duty:out.customs?.duty,regulationCount:out.customs?.regulation.items.length??0,landedCost:out.customs?.landedCost,
     diagnostics:{methodology:out.methodology,normalizedProduct:out.normalizedProduct,missingInformation:out.missingInformation,followUpQuestions:out.followUpQuestions,warnings:out.warnings,candidateCount:out.candidates.length}});
   }catch(e){results.push({id:c.id,expectedHs4:c.expectedHs4,pass:false,error:e instanceof Error?e.message:String(e)});}
 }
 return Response.json({generatedAt:new Date().toISOString(),summary:{passed:results.filter(x=>x.pass).length,total:results.length},results});
}}}});
