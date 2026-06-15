import { useState } from 'react'
import { useBoxes } from '../hooks/useBoxes'
import { PhotoThumbs } from './PhotoThumbs'

// SPEC 6.4 — Unpack. Search by BoxBuddy number or the packing company's number;
// show all matches (a number can repeat across rooms, SPEC 4.3); "Box not found"
// on no match.
export default function Unpack() {
  const { boxes } = useBoxes()
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const searched = trimmed !== ''
  const matches = searched
    ? boxes.filter(
        (b) =>
          String(b.boxNumber) === trimmed ||
          (b.packingNumber ?? '').trim().toLowerCase() === trimmed.toLowerCase(),
      )
    : []

  return (
    <section className="mx-auto max-w-xl p-4">
      <h2 className="mb-1 text-xl font-semibold">Unpack</h2>
      <p className="mb-3 text-sm text-muted">
        Enter a box number or the packing company's number to see its room, contents, and
        photos before opening it.
      </p>

      <input
        type="text"
        inputMode="numeric"
        className="field w-full"
        placeholder="Box number or packing #"
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
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold tabular-nums">#{box.boxNumber}</span>
              <span className="text-sm text-muted">{box.room}</span>
              {box.packingNumber && (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                  Pkg #{box.packingNumber}
                </span>
              )}
              {box.urgent && (
                <span className="rounded bg-danger/20 px-1.5 py-0.5 text-xs text-danger">
                  Urgent
                </span>
              )}
            </div>
            {box.description && <p className="mb-2 text-sm">{box.description}</p>}
            <PhotoThumbs urls={box.photoUrls} size="size-24" />
          </div>
        ))}
      </div>

      {searched && matches.length > 1 && (
        <p className="mt-3 text-xs text-muted">
          {matches.length} boxes match “{trimmed}” — check the room to find the right one.
        </p>
      )}
    </section>
  )
}
