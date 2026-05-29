
-- shipment_legs
REVOKE ALL ON public.shipment_legs FROM anon, authenticated;
GRANT ALL ON public.shipment_legs TO service_role;
DROP POLICY IF EXISTS shipment_legs_no_public_access ON public.shipment_legs;
CREATE POLICY shipment_legs_no_public_access
  ON public.shipment_legs AS RESTRICTIVE FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

-- newsletter_subscribers
DROP POLICY IF EXISTS anyone_can_subscribe ON public.newsletter_subscribers;
DROP POLICY IF EXISTS newsletter_anon_insert_validated ON public.newsletter_subscribers;
CREATE POLICY newsletter_anon_insert_validated
  ON public.newsletter_subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 254
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );
REVOKE SELECT, UPDATE, DELETE ON public.newsletter_subscribers FROM anon, authenticated;
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

-- industry_chapter_stats view: security_invoker
DROP VIEW IF EXISTS public.industry_chapter_stats;
CREATE VIEW public.industry_chapter_stats
WITH (security_invoker = true) AS
SELECT
  period,
  left(hs_code, 2) AS hs_chapter,
  sum(export_usd)    AS export_usd,
  sum(import_usd)    AS import_usd,
  sum(export_weight) AS export_weight,
  sum(import_weight) AS import_weight,
  sum(export_usd) - sum(import_usd) AS trade_balance
FROM public.trade_statistics
GROUP BY period, left(hs_code, 2);
GRANT SELECT ON public.industry_chapter_stats TO anon, authenticated;
