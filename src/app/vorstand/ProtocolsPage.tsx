import { useMemo, useRef, useState, type SubmitEvent } from 'react';
import { Eye, FileText, Trash2, Upload } from 'lucide-react';
import { col, toProtocol, useLiveCollection, type Protocol } from '../data/collections';
import { deleteProtocol, PROTOCOL_MAX_BYTES, uploadProtocol } from '../data/repo';
import { EmptyState, ErrorNotice, PageTitle, Spinner } from '../ui/misc';
import { errorMessage, useConfirm, useToast } from '../ui/feedback';
import { formatDate } from '../../lib/dates';

export function ProtocolsPage() {
  const protocols = useLiveCollection(col.protocols, toProtocol);
  const confirm = useConfirm();
  const toast = useToast();

  const sorted = useMemo(
    () => [...protocols.data].sort((a, b) => b.date.localeCompare(a.date) || (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '')),
    [protocols.data],
  );

  async function remove(protocol: Protocol) {
    const ok = await confirm({
      title: 'Protokoll löschen?',
      message: `Möchten Sie das Protokoll „${protocol.title}“ wirklich löschen? Die PDF-Datei wird ebenfalls entfernt.`,
      confirmLabel: 'Löschen',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteProtocol(protocol);
      toast.success('Protokoll gelöscht.');
    } catch (error) {
      toast.error(`Fehler beim Löschen des Protokolls: ${errorMessage(error)}`);
    }
  }

  return (
    <>
      <PageTitle title="Sitzungsprotokolle verwalten" description="Nur für den Vorstand sichtbar." />
      <div className="two-col">
        <UploadForm />
        <section className="panel">
          <header className="panel__header">
            <h2>Alle Protokolle</h2>
          </header>
          {protocols.loading ? (
            <Spinner label="Lade Protokolle..." />
          ) : protocols.error ? (
            <ErrorNotice>Fehler beim Laden der Protokolle. {errorMessage(protocols.error)}</ErrorNotice>
          ) : sorted.length === 0 ? (
            <EmptyState icon={<FileText aria-hidden="true" />} title="Noch keine Protokolle vorhanden." />
          ) : (
            <ul role="list" className="protocols">
              {sorted.map((protocol) => (
                <li key={protocol.id} className="protocol">
                  <FileText aria-hidden="true" className="protocol__icon" />
                  <div className="protocol__info">
                    <h3>{protocol.title}</h3>
                    <p className="muted">
                      Datum: {formatDate(protocol.date)}
                      {protocol.uploadedAt && ` · Hochgeladen: ${new Date(protocol.uploadedAt).toLocaleDateString('de-DE')}`}
                    </p>
                  </div>
                  <div className="protocol__actions">
                    <a className="btn btn--sm" href={protocol.fileUrl} target="_blank" rel="noopener">
                      <Eye aria-hidden="true" /> Anschauen/Download
                    </a>
                    <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => remove(protocol)}>
                      <Trash2 aria-hidden="true" /> Löschen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function UploadForm() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(next: File | undefined | null) {
    if (!next) return;
    if (next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Bitte eine PDF-Datei auswählen.');
      return;
    }
    if (next.size > PROTOCOL_MAX_BYTES) {
      toast.error('Datei ist zu groß. Maximal 10 MB erlaubt.');
      return;
    }
    setFile(next);
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!file) {
      toast.error('Bitte wählen Sie eine Datei aus.');
      return;
    }
    setProgress(0);
    try {
      await uploadProtocol(file, { title: title.trim(), date }, setProgress);
      toast.success('Protokoll erfolgreich hochgeladen!');
      setTitle('');
      setDate('');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      toast.error(`Fehler beim Hochladen des Protokolls: ${errorMessage(error)}`);
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Protokoll hochladen</h2>
      </header>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="pr-title">
            Titel *
          </label>
          <input
            id="pr-title"
            className="input"
            required
            placeholder="z.B. Jahreshauptversammlung 2025"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="pr-date">
            Datum *
          </label>
          <input id="pr-date" className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <span className="label">Protokoll-Datei (PDF) *</span>
          <label
            className={`file-drop${dragOver ? ' is-dragover' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="visually-hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <Upload aria-hidden="true" />
            <span>Klicken Sie hier oder ziehen Sie eine PDF-Datei hierher</span>
            <span className="hint">Maximal 10 MB</span>
            {file && (
              <strong className="file-drop__file">
                ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </strong>
            )}
          </label>
          {busy && <progress max={1} value={progress ?? 0} className="progress" />}
        </div>
        <div className="form__actions">
          <button type="submit" className="btn btn--primary" disabled={busy || !title.trim() || !date || !file}>
            {busy ? 'Wird hochgeladen...' : 'Protokoll hochladen'}
          </button>
        </div>
      </form>
    </section>
  );
}
