export default function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-10 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-500">Ee module {phase} lo build chestam. Database, permissions, layout ready ga unnayi.</p>
    </div>
  )
}
