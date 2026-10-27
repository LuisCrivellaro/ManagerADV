export const connectionCatalog = [
 {id:'projuris',name:'ProJuris',purpose:'Clientes, processos e documentos',documentation:'https://docs.projurisadv.com.br/#top',requirements:[{key:'PROJURIS_API_URL',label:'Endereço da API do escritório'},{key:'PROJURIS_ACCESS_TOKEN',label:'Autorização da API'}]},
 {id:'zapsign',name:'ZapSign',purpose:'Assinaturas de documentos',documentation:'https://docs.zapsign.com.br',requirements:[{key:'ZAPSIGN_API_TOKEN',label:'Token da ZapSign'}]},
 {id:'mercadopago',name:'Mercado Pago',purpose:'Cobranças e pagamentos',documentation:'https://www.mercadopago.com.br/developers/pt/docs',requirements:[{key:'MERCADOPAGO_ACCESS_TOKEN',label:'Access Token'}]},
 {id:'ultramsg',name:'UltraMsg',purpose:'WhatsApp do escritório',documentation:'https://docs.ultramsg.com',requirements:[{key:'ULTRAMSG_INSTANCE_ID',label:'Identificador da instância'},{key:'ULTRAMSG_TOKEN',label:'Token da UltraMsg'}]},
] as const;
export function connectionReadiness(present:Record<string,boolean>) { return connectionCatalog.map(c=>({id:c.id,credentialsPresent:c.requirements.every(r=>present[r.key]),missing:c.requirements.filter(r=>!present[r.key]).map(r=>r.label)})); }
export type ConnectionId=typeof connectionCatalog[number]['id'];