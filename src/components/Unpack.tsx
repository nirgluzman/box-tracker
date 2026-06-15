import { useState } from 'react'
import { useBoxes } from '../hooks/useBoxes'
import { deleteBox } from '../data/boxes'
import { confirmAction } from '../data/confirmPrefs'
import { PhotoThumbs } from './PhotoThumbs'
import { Spinner } from './Spinner'
import { TrashIcon } from './icons'
import type { BoxDoc } from '../types'

// Normalize for matching: lowercase, strip punctuation (keeps Hebrew/Latin
// letters + digits), collapse to space-separated tokens.
const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

// "Smart" content match: every query word must hit some description word, where
// a hit is exact OR one contains the other (>=2 chars). Bidirectional substring
// covers plurals (glass/glasses, plate/plates) and Hebrew attached prefixes
// (צלחות / וצלחות) without a stemmer.
function matchesContent(description: string, query: string): boolean {
  const q = tokenize(query)
  if (q.length === 0) return false
  const d = tokenize(description)
  return q.every((qt) =>
    d.some(
      (dt) =>
        dt === qt ||
        (qt.length >= 2 && dt.includes(qt)) ||
        (dt.length >= 2 && qt.includes(dt)),
    ),
  )
}

// SPEC 6.4 - Unpack. Search by BoxBuddy number, the packing company's number, or
// box contents (text); show all matches; "Box not found" on no match.
export default function Unpack() {
  const { boxes } = useBoxes()
  const [numQuery, setNumQuery] = useState('')
  const [textQuery, setTextQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // The box was opened and emptied during unpacking - remove it and its photos.
  async function handleDelete(box: BoxDoc) {
    if (!confirmAction('deleteBox', `Delete Box #${box.boxNumber} (${box.room})? This also removes its photos.`))
      return
    setDeletingId(box.id)
    try {
      await deleteBox(box)
    } finally {
      setDeletingId(null)
    }
  }

  const num = numQuery.trim()
  const text = textQuery.trim()
  const searched = num !== '' || text !== ''
  const matches = searched
    ? boxes.filter(
        (b) =>
          (num === '' ||
            String(b.boxNumber) === num ||
            (b.packingNumber ?? '').trim().toLowerCase() === num.toLowerCase()) &&
          (text === '' || matchesContent(b.description ?? '', text)),
      )
    : []

  return (
    <section className="mx-auto max-w-xl p-4">
      <h2 className="mb-1 text-xl font-semibold">Unpack</h2>
      <p className="mb-3 text-sm text-muted">
        Search by box number, packing number, or what's inside (e.g. “glass” finds boxes
        holding glasses) to see a box's room, contents, and photos before opening it.
      </p>

      <div className="flex flex-col gap-2">
        <input
          type="text"
          inputMode="numeric"
          className="field w-full"
          placeholder="Box number or packing #"
          value={numQuery}
          onChange={(e) => setNumQuery(e.target.value)}
          autoFocus
        />
        <input
          type="text"
          className="field w-full"
          placeholder="Search contents (e.g. glass, books)"
          value={textQuery}
          onChange={(e) => setTextQuery(e.target.value)}
        />
      </div>

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
              <button
                type="button"
                className="btn ml-auto"
                onClick={() => handleDelete(box)}
                disabled={deletingId === box.id}
                aria-label={`Delete Box #${box.boxNumber}`}
                title="Delete (box opened / emptied)"
              >
                {deletingId === box.id ? <Spinner /> : <TrashIcon />}
              </button>
            </div>
            {box.description && <p className="mb-2 text-sm">{box.description}</p>}
            <PhotoThumbs urls={box.photoUrls} size="size-24" />
          </div>
        ))}
      </div>

      {searched && matches.length > 1 && (
        <p className="mt-3 text-xs text-muted">
          {matches.length} boxes match - check the room to find the right one.
        </p>
      )}
    </section>
  )
}
