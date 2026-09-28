import { describe, expect, it, vi, beforeEach } from "vitest";

const chain:any={};
for(const name of ["from","select","eq","neq","in","order","limit"]) chain[name]=vi.fn(()=>chain);
chain.then=(resolve:any)=>resolve({data:[],error:null});
vi.mock("@/integrations/supabase/public.server",()=>({supabasePublicServer:chain}));

describe("classification evidence regression",()=>{
  beforeEach(()=>Object.values(chain).forEach((x:any)=>x?.mockClear?.()));
  it("quarantines the invalid first PDF import batch",async()=>{
    const {findEuClassificationEvidence}=await import("@/server/classification-evidence");
    await findEuClassificationEvidence("33049900");
    expect(chain.eq).toHaveBeenCalledWith("is_active",true);
    expect(chain.neq).toHaveBeenCalledWith("source_version","2026-02-11");
  });
});
