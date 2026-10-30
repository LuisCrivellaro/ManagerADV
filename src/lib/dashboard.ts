export function deadlineState(date: string, today: string) {
  if(date < today)return 'Vencido';
  if(date === today)return 'Hoje';
  return 'A vencer';
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}