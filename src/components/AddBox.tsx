import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { auth } from '../firebase';
import { useRooms } from '../hooks/useRooms';
import { useBoxes } from '../hooks/useBoxes';
import { useOnline } from '../hooks/useOnline';
import { useIsTouch } from '../hooks/useIsTouch';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { summarize } from '../llm';
import { rangeEnd } from '../data/rooms';
import { createBox, isRangeOverflow, newBoxId, nextBoxNumber } from '../data/boxes';
import { deletePhotoPaths, uploadBoxPhoto, type UploadedPhoto } from '../data/photos';
import { confirmAction } from '../data/confirmPrefs';
import { Spinner } from './Spinner';
import { Lightbox } from './PhotoThumbs';
import { MicVisualizer } from './MicVisualizer';
import type { RoomDoc } from '../types';

// Friendly text for Web Speech API error codes (otherwise the failure is silent).
function micErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access blocked. Allow mic access for this site in the browser, then try again.';
    case 'audio-capture':
      return 'No microphone found. Check your mic and try again.';
    case 'no-speech':
      return "Didn't catch anything. Tap Speak and talk a bit louder.";
    case 'network':
      return 'Voice recognition needs a network connection and failed to reach it.';
    default:
      return "Voice input didn't work. Try again.";
  }
}

// SPEC 6.2 - Add Box.
export default function AddBox() {
  const { rooms } = useRooms();
  const { boxes } = useBoxes();
  const online = useOnline();
  const isTouch = useIsTouch();

  const [docId, setDocId] = useState(newBoxId);
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [packingNumber, setPackingNumber] = useState('');
  const [description, setDescription] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Post-save confirmation modal: the user must dismiss it (OK) before adding the
  // next box, so the assigned number is never missed (SPEC 4.3 / 6.2).
  const [confirmation, setConfirmation] = useState<{
    boxNumber: number;
    room: string;
    color: string;
    overflow: string | null;
  } | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [removingPath, setRemovingPath] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  // Recognizer language. The Web Speech API handles one language per recording;
  // switch this to dictate German/English items so they stay in Latin letters
  // (Hebrew recognition would transliterate them). Recordings append together.
  const [recLang, setRecLang] = useState('he-IL');

  // When dictation ends, summarize the final transcript and append it to the
  // description (don't overwrite) - the user may record in several passes.
  const speech = useSpeechRecognition(recLang, (text) => {
    setSummarizing(true);
    summarize(text)
      .then((s) => {
        const add = s.trim();
        if (!add) return;
        setDescription((prev) => {
          const base = prev.trim();
          return base ? `${base}, ${add}` : add;
        });
      })
      .finally(() => setSummarizing(false));
  });

  // Refs for the unmount-time orphaned-photo prompt (SPEC 6.2).
  const photosRef = useRef<UploadedPhoto[]>([]);
  const savedRef = useRef(false);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      if (!savedRef.current && photosRef.current.length > 0) {
        const ok = window.confirm(
          `You added ${photosRef.current.length} photo(s) but didn't save this box. Delete them?`
        );
        if (ok) deletePhotoPaths(photosRef.current.map((p) => p.path));
      }
    };
  }, []);

  function toggleMic() {
    if (speech.listening) speech.stop();
    else speech.start();
  }

  async function handlePhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-selecting the same file
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const uploaded = await uploadBoxPhoto(docId, file);
        setPhotos((prev) => [...prev, uploaded]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photo: UploadedPhoto) {
    if (!confirmAction('deletePhoto', 'Delete this photo?')) return;
    setRemovingPath(photo.path);
    try {
      await deletePhotoPaths([photo.path]);
      setPhotos((prev) => prev.filter((p) => p.path !== photo.path));
    } finally {
      setRemovingPath(null);
    }
  }

  function resetForm() {
    savedRef.current = false;
    setDocId(newBoxId());
    setRoom(null);
    setPackingNumber('');
    setDescription('');
    setUrgent(false);
    setPhotos([]);
    speech.reset();
  }

  async function handleSave() {
    if (!room || saving) return;
    setSaving(true);
    try {
      const boxNumber = nextBoxNumber(room.name, room.rangeStart, boxes);
      await createBox(docId, {
        boxNumber,
        packingNumber: packingNumber.trim(),
        room: room.name,
        roomColor: room.color,
        description: description.trim(),
        urgent,
        photoUrls: photos.map((p) => p.url),
        addedBy: auth.currentUser?.email ?? 'unknown',
      });
      savedRef.current = true; // photos now belong to a saved box

      const overflow = isRangeOverflow(boxNumber, room.rangeStart)
        ? `Box #${boxNumber} exceeds the ${room.name} range (${room.rangeStart}-${rangeEnd(
            room.rangeStart
          )}) - consider widening the range in Config.`
        : null;
      setConfirmation({ boxNumber, room: room.name, color: room.color, overflow });
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className='mx-auto max-w-xl p-4'>
      <h2 className='mb-2 text-xl font-semibold'>Add Box</h2>

      {confirmation && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
          role='alertdialog'
          aria-modal='true'
          aria-labelledby='save-confirm-title'
          onClick={() => setConfirmation(null)}>
          <div
            className='w-full max-w-sm rounded-2xl border border-edge bg-bg p-6 text-center shadow-2xl'
            onClick={(e) => e.stopPropagation()}>
            <p id='save-confirm-title' className='text-lg font-semibold text-muted'>
              Box number
            </p>
            <p className='my-2 text-6xl font-extrabold tabular-nums tracking-tight'>
              {confirmation.boxNumber}
            </p>
            <div
              className='mx-auto mt-4 h-20 w-20 rounded-2xl ring-1 ring-edge'
              style={{ background: confirmation.color }}
              aria-hidden='true'
            />
            <p className='mt-3 text-sm text-muted'>
              Label this box - match the {confirmation.room} sticker color
            </p>
            {confirmation.overflow && (
              <p className='mt-3 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-300'>
                {confirmation.overflow}
              </p>
            )}
            <button
              type='button'
              autoFocus
              onClick={() => setConfirmation(null)}
              className='mt-5 w-full rounded-lg bg-accent px-4 py-3 text-base font-semibold text-white'>
              OK
            </button>
          </div>
        </div>
      )}

      {/* Room picker (SPEC 6.2) */}
      <fieldset className='mb-3'>
        <legend className='mb-2 text-sm text-muted'>Room</legend>
        {rooms.length === 0 ? (
          <p className='text-sm text-muted'>No rooms yet - add rooms in Config first.</p>
        ) : (
          <div className='flex flex-wrap gap-2'>
            {rooms.map((r) => {
              const selected = room?.id === r.id;
              return (
                <button
                  key={r.id}
                  type='button'
                  onClick={() => setRoom(r)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    selected ? 'border-accent bg-accent/15 font-semibold' : 'border-edge'
                  }`}
                  aria-pressed={selected}>
                  <span className='size-3 rounded-full' style={{ background: r.color }} aria-hidden='true' />
                  {r.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      {/* Packing company number (optional, for identification) */}
      <div className='mb-3'>
        <label htmlFor='packing' className='mb-1 block text-sm text-muted'>
          Packing company #
        </label>
        <input
          id='packing'
          type='text'
          inputMode='numeric'
          className='field w-full'
          value={packingNumber}
          onChange={(e) => setPackingNumber(e.target.value)}
          placeholder="Optional - the number on the company's label"
        />
      </div>

      {/* Description + mic (SPEC 6.2 / 7) */}
      <div className='mb-3'>
        <div className='mb-2 flex items-center justify-between gap-2'>
          <label htmlFor='desc' className='flex items-center gap-2 text-sm text-muted'>
            Description
            {summarizing && <Spinner className='size-3.5' />}
          </label>
          <div className='flex items-center gap-2'>
            {/* Pick the spoken language so foreign words keep their own script. */}
            <select
              className='field py-1.5 text-sm'
              value={recLang}
              onChange={(e) => setRecLang(e.target.value)}
              disabled={speech.listening}
              aria-label='Voice language'
              title='Language you will speak in'>
              <option value='he-IL'>עברית</option>
              <option value='en-US'>English</option>
              <option value='de-DE'>Deutsch</option>
            </select>
            <button
              type='button'
              className='btn'
              onClick={toggleMic}
              disabled={!online || !speech.supported}
              title={
                !online
                  ? 'Voice input needs a connection'
                  : !speech.supported
                    ? 'Voice not supported on this browser'
                    : undefined
              }>
              {speech.listening ? '■ Stop' : '🎤 Speak'}
            </button>
          </div>
        </div>
        {speech.listening && (
          <div className='mb-2 flex items-center gap-3'>
            <MicVisualizer active={speech.listening} />
            <p className='text-sm text-muted' aria-live='polite'>
              {speech.transcript || 'Listening…'}
            </p>
          </div>
        )}
        {speech.error && !speech.listening && (
          <p className='mb-2 text-sm text-danger' role='alert'>
            {micErrorMessage(speech.error)}
          </p>
        )}
        {/* Two lines by default; drag the bottom-right handle to enlarge. */}
        <textarea
          id='desc'
          rows={2}
          className='field w-full resize-y'
          value={summarizing ? 'Summarizing…' : description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='Type, or use the mic'
          disabled={summarizing}
        />
        {!online && <p className='mt-1 text-xs text-muted'>Voice input needs a connection.</p>}
      </div>

      {/* Photos (SPEC 6.2) */}
      <div className='mb-3'>
        <div className='mb-2 flex flex-wrap items-center gap-3'>
          {/* Take photo: capture='environment' opens the rear camera. Disabled
              on laptops (no rear camera, `capture` is ignored there) - use
              Gallery instead. No `multiple` here - browsers ignore `capture`
              when `multiple` is also set. */}
          <label
            title={!isTouch ? 'Camera not available on this device - use Gallery' : undefined}
            className={`btn inline-flex items-center gap-2 ${!online || uploading || !isTouch ? 'pointer-events-none opacity-50' : ''}`}>
            {uploading ? (
              <>
                <Spinner /> Uploading…
              </>
            ) : (
              '📷 Take photo'
            )}
            <input
              type='file'
              accept='image/*'
              capture='environment'
              className='hidden'
              onChange={handlePhotos}
              disabled={!online || uploading || !isTouch}
            />
          </label>
          {/* Gallery: multi-select from existing photos (no camera capture). */}
          <label
            className={`btn inline-flex items-center gap-2 ${!online || uploading ? 'pointer-events-none opacity-50' : ''}`}>
            🖼 Gallery
            <input
              type='file'
              accept='image/*'
              className='hidden'
              multiple
              onChange={handlePhotos}
              disabled={!online || uploading}
            />
          </label>
          {!online && <span className='text-xs text-muted'>Add photos later when back online.</span>}
        </div>
        {photos.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {photos.map((p, idx) => (
              <div key={p.path} className='relative'>
                <button
                  type='button'
                  onClick={() => setViewer(idx)}
                  className='block rounded-lg'
                  aria-label='View photo full screen'>
                  <img
                    src={p.url}
                    alt=''
                    className='size-20 rounded-lg border border-edge object-cover'
                  />
                </button>
                {removingPath === p.path ? (
                  <div className='absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-white'>
                    <Spinner />
                  </div>
                ) : (
                  <button
                    type='button'
                    onClick={() => removePhoto(p)}
                    className='absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-danger text-xs text-white'
                    aria-label='Remove photo'>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Urgent toggle (SPEC 6.2) */}
      <div className='mb-3'>
        <label className='flex items-center gap-2'>
          <input type='checkbox' checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className='size-4' />
          Urgent
          <span className='text-xs text-muted'>- open first</span>
        </label>
      </div>

      <button
        type='button'
        className='btn btn-primary inline-flex w-full items-center justify-center gap-2'
        onClick={handleSave}
        disabled={!room || saving || uploading}>
        {saving ? (
          <>
            <Spinner /> Saving…
          </>
        ) : (
          'Save box'
        )}
      </button>

      {viewer !== null && (
        <Lightbox
          photos={photos.map((p) => p.url)}
          index={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  );
}
