import { describe, it, expect } from 'vitest';
import { connectionReadiness } from '@/lib/integration-status';
describe('Credenciais das conexões',()=>{
 it('exige endereço e autorização do ProJuris',()=>{expect(connectionReadiness({PROJURIS_API_URL:true}).find(s=>s.id==='projuris')?.credentialsPresent).toBe(false);expect(connectionReadiness({PROJURIS_API_URL:true,PROJURIS_ACCESS_TOKEN:true}).find(s=>s.id==='projuris')?.credentialsPresent).toBe(true);});
 it('exige instância e token UltraMsg',()=>{expect(connectionReadiness({ULTRAMSG_TOKEN:true}).find(s=>s.id==='ultramsg')?.credentialsPresent).toBe(false);});
});