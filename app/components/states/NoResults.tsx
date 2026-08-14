type NoResultsProps = {
  query: string;
};

export default function NoResults({ query }: NoResultsProps) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-mist-50">No encontramos “{query}”</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-mist-500">
        Probá agregando la localidad o la provincia.
      </p>
    </div>
  );
}
