export function StringCopied(textToCopy: string) {
  return (
    <div className="flex">
      <p>Copiado</p>
      <span className="font-bold">{textToCopy}</span>
      <p>al clipboard</p>
    </div>
  );
}
