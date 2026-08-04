export default function Commentary({ body }: { body?: string }) {
  if (!body) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-700 whitespace-pre-line">{body}</p>
    </div>
  );
}
