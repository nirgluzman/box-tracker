import type { BoxDoc } from '../types'

// CSV export per SPEC 8.1. Always called with the FULL boxes collection —
// import infers deletions from absent rows, so a filtered export would wrongly
// delete the filtered-out boxes.
const COLUMNS = ['Box Number', 'Room', 'Description', 'Urgent', 'Added By', 'Date Added', '_docId']

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
