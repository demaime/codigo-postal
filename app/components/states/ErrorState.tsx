"use client";

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="px-6 py-16 text-center">
      <p className="mx-auto max-w-sm text-mist-50">{message}</p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-4 text-sm font-medium text-beak-500 transition-colors hover:text-beak-300"
      >
        Reintentar
      </button>
    </div>
  );
}
