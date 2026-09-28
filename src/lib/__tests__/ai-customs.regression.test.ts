import { describe, expect, it } from "vitest";
import { hsClassificationInputSchema } from "@/server/hs-classification";
import { getEuStandardVat } from "@/server/eu-vat";

describe("AI Customs regression: commercial inputs", () => {
  it.each([
    ["DE",19],["FR",20],["NL",21],["PL",23],["HU",27],["FI",25.5]
  ])("resolves standard VAT for %s", (country, expected) => {
    expect(getEuStandardVat(country)).toBe(expected);
  });

  it("accepts complete landed-cost inputs", () => {
    const x=hsClassificationInputSchema.parse({
      description:"Niacinamide 10% facial serum, 50 ml retail bottle, cosmetic skin-care product",
      originCountry:"KR",destinationMarket:"EU",destinationCountry:"DE",
      productValue:1000,freight:100,insurance:10
    });
    expect(x.productValue+x.freight!+x.insurance!).toBe(1110);
    expect(getEuStandardVat(x.destinationCountry)).toBe(19);
  });

  it.each([
    "Cotton men's woven shirt, 100% cotton, retail garment",
    "Bluetooth wireless earphones with charging case, lithium-ion battery included",
    "Rechargeable lithium-ion battery pack, 100 Wh, for portable electronic equipment",
    "Roasted coffee beans, 1 kg retail bag, for human consumption",
    "Sterile disposable medical syringe without needle, for clinical use",
    "Automotive brake pad set for passenger motor vehicles",
    "Centrifugal electric water pump for industrial liquid transfer",
  ])("accepts regression product description: %s",(description)=>{
    expect(()=>hsClassificationInputSchema.parse({description,originCountry:"KR",destinationMarket:"EU",destinationCountry:"DE"})).not.toThrow();
  });
});
