import { describe, it, expect } from 'vitest';
import { connectionReadiness } from '@/lib/integration-status';
describe('Credenciais das conexões',()=>{
 it('exige identificador e chave secreta do ProJuris (client_credentials)',()=>{expect(connectionReadiness({PROJURIS_CLIENT_ID:true}).find(s=>s.id==='projuris')?.credentialsPresent).toBe(false);expect(connectionReadiness({PROJURIS_CLIENT_ID:true,PROJURIS_CLIENT_SECRET:true}).find(s=>s.id==='projuris')?.credentialsPresent).toBe(true);expect(connectionReadiness({PROJURIS_API_URL:true,PROJURIS_ACCESS_TOKEN:true}).find(s=>s.id==='projuris')?.credentialsPresent).toBe(false);});
 it('exige instância e token UltraMsg',()=>{expect(connectionReadiness({ULTRAMSG_TOKEN:true}).find(s=>s.id==='ultramsg')?.credentialsPresent).toBe(false);});
});