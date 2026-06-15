import type { Box, BoxDoc } from '../types'

// CSV export per SPEC 8.1. Always called with the FULL boxes collection -
// import infers deletions from absent rows, so a filtered export would wrongly
// delete the filtered-out boxes.
const COLUMNS = [
  'Box Number',
  'Packing Number',
  'Room',
  'Description',
  'Urgent',
  'Added By',
  'Date Added',
  '_docId',
]

function escape(value: string | number): string {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// createdAt -> YYYY-MM-DD. Pending (unsynced) writes have no resolved timestamp.
function dateAdded(box: BoxDoc): string {
  const d = box.createdAt?.toDate?.()
  return d ? d.toISOString().slice(0, 10) : ''
}

export function boxesToCsv(boxes: BoxDoc[]): string {
  const rows = boxes.map((b) =>
    [
      b.boxNumber,
      b.packingNumber ?? '',
      b.room,
      b.description,
      b.urgent ? 'Yes' : 'No',
      b.addedBy,
      dateAdded(b),
      b.id,
    ]
      .map(escape)
      .join(','),
  )
  return [COLUMNS.join(','), ...rows].join('\r\n')
}

// --- Import (SPEC 8.2) ---

// RFC-4180-ish parser: handles quoted fields, escaped quotes, and CRLF/LF.
export function parseCsv(input: string): string[][] {
  let text = input
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // strip BOM

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        field += c
        i++
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
    } else if (c === ',') {
      row.push(field)
      field = ''
      i++
    } else if (c === '\r') {
      i++
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else {
      field += c
      i++
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Drop fully-empty trailing rows.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

export interface ImportRecord {
  boxNumber: number
  packingNumber: string
  room: string
  description: string
  urgent: boolean
  addedBy: string
  docId: string
}

// Map parsed rows to records by header name (column order is tolerated).
export function csvToRecords(rows: string[][]): ImportRecord[] {
  if (rows.length === 0) throw new Error('The file is empty.')
  const header = rows[0].map((h) => h.trim())
  const col = (name: string) => header.indexOf(name)
  for (const required of ['Box Number', 'Room', '_docId']) {
    if (col(required) === -1) throw new Error(`Missing required column: ${required}`)
  }
  const get = (r: string[], name: string) => {
    const idx = col(name)
    return idx === -1 ? '' : (r[idx] ?? '')
  }
  return rows.slice(1).map((r) => ({
    boxNumber: Number(get(r, 'Box Number')),
    packingNumber: get(r, 'Packing Number').trim(),
    room: get(r, 'Room').trim(),
    description: get(r, 'Description'),
    urgent: /^yes$/i.test(get(r, 'Urgent').trim()),
    addedBy: get(r, 'Added By'),
    docId: get(r, '_docId').trim(),
  }))
}

export interface ImportPlan {
  updates: {
    id: string
    patch: Pick<Box, 'boxNumber' | 'packingNumber' | 'room' | 'roomColor' | 'description' | 'urgent'>
  }[]
  creates: Omit<Box, 'createdAt'>[]
  deletes: BoxDoc[]
  highDeletion: boolean // file looks partial - needs extra confirmation
}

// Pure diff between the uploaded file and current boxes (SPEC 8.2). Existing ids
// absent from the file are deletions - safe only because export is full dataset.
export function planImport(
  records: ImportRecord[],
  boxes: BoxDoc[],
  rooms: { name: string; color: string }[],
): ImportPlan {
  const byId = new Map(boxes.map((b) => [b.id, b]))
  const colorByRoom = new Map(rooms.map((r) => [r.name, r.color]))
  const seen = new Set<string>()
  const updates: ImportPlan['updates'] = []
  const creates: ImportPlan['creates'] = []

  for (const rec of records) {
    const existing = rec.docId ? byId.get(rec.docId) : undefined
    if (existing) {
      seen.add(existing.id)
      updates.push({
        id: existing.id,
        patch: {
          boxNumber: rec.boxNumber,
          packingNumber: rec.packingNumber,
          room: rec.room,
          // roomColor follows the room; keep existing color if the room is unknown.
          roomColor: colorByRoom.get(rec.room) ?? existing.roomColor,
          description: rec.description,
          urgent: rec.urgent,
        },
      })
    } else {
      creates.push({
        boxNumber: rec.boxNumber,
        packingNumber: rec.packingNumber,
        room: rec.room,
        roomColor: colorByRoom.get(rec.room) ?? '',
        description: rec.description,
        urgent: rec.urgent,
        addedBy: rec.addedBy || 'import',
        photoUrls: [],
      })
    }
  }

  const deletes = boxes.filter((b) => !seen.has(b.id))
  const highDeletion = deletes.length > 0 && deletes.length / Math.max(boxes.length, 1) >= 0.3
  return { updates, creates, deletes, highDeletion }
}

// Triggers a UTF-8 (with BOM) download of the full dataset.
export function downloadBoxesCsv(boxes: BoxDoc[]): void {
  const csv = '﻿' + boxesToCsv(boxes) // UTF-8 BOM (SPEC 8.1)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `boxes-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
