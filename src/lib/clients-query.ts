import { queryOptions } from '@tanstack/react-query';
import { readClients } from '@/lib/clients.functions';
export const clientsQuery = () => queryOptions({ queryKey: ['clients-directory'], queryFn: () => readClients(), staleTime: 15_000, refetchInterval: 15_000 });