import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { integrationCatalog, integrationReadiness } from './integration-readiness';

export const readIntegrationReadiness = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const configured: Record<string, boolean> = {};
    for (const service of integrationCatalog) {
      for (const requirement of service.requirements) {
        configured[requirement.key] = Boolean(process.env[requirement.key]?.trim());
      }
    }
    return integrationReadiness(configured);
  });