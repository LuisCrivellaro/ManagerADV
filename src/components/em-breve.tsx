export function EmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="p-8">
      <h1 className="section-title text-2xl">{titulo}</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">{descricao}</p>
      <p className="mt-6 inline-block rounded bg-pending px-2 py-1 text-sm text-pending-foreground">[EM CONSTRUÇÃO — próxima etapa]</p>
    </div>
  );
}
