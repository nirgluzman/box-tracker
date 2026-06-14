import { useState } from 'react'
import { useBoxes } from '../hooks/useBoxes'

// SPEC 6.4 — Unpack. Search by box number; show all matches (a number can
// repeat across rooms, SPEC 4.3); "Box not found" on no match.
export default function Unpack() {
  const { boxes } = useBoxes()
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const num = Number(trimmed)
  const searched = trimmed !== '' && Number.isFinite(num)
  const matches = searched ? boxes.filter((b) => b.boxNumber === num) : []

  return (
    <section className="mx-auto max-w-xl p-4">
      <h2 className="mb-3 text-xl font-semibold">Unpack</h2>

      <input
        type="number"
        inputMode="numeric"
        className="field w-full"
        placeholder="Box number"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {searched && matches.length === 0 && (
        <p className="mt-4 text-muted">Box not found.</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {matches.map((box) => (
          <div
            key={box.id}
            className="rounded-lg border border-edge bg-surface p-3"
            style={{ borderLeft: `4px solid ${box.roomColor}` }}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-lg font-bold tabular-nums">#{box.boxNumber}</span>
              <span className="text-sm text-muted">{box.room}</span>
              {box.urgent && (
                <span className="rounded bg-danger/20 px-1.5 py-0.5 text-xs text-danger">
                  Urgent
                </span>
              )}
            </div>
            {box.description && <p className="mb-2 text-sm">{box.description}</p>}
            {box.photoUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {box.photoUrls.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="size-24 rounded border border-edge object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {searched && matches.length > 1 && (
        <p className="mt-3 text-xs text-muted">
          {matches.length} boxes share #{num} — check the room to find the right one.
        </p>
      )}
    </section>
  )
}
