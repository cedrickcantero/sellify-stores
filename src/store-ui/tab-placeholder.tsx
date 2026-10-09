// Stand-in for a store tab until its own ticket builds it.
export function TabPlaceholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-(family-name:--store-font-heading) text-3xl font-bold">{title}</h1>
      <p className="text-(--store-text)/75">{text}</p>
    </div>
  );
}
