// Read out by screen readers when a form is rejected: the form-level message
// and every field error, in one live region. Renders nothing when there is
// nothing to say, so it appears (and is announced) only after a failed submit.
export function ErrorSummary({ message, errors }: { message?: string; errors: string[] }) {
  if (!message && errors.length === 0) return null;
  return (
    <div role="alert" className="rounded-(--store-radius) border-2 border-(--store-text) p-3 font-semibold">
      {message ? <p>{message}</p> : null}
      {errors.length > 0 ? (
        <ul className="list-disc pl-5">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
