import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCheck, CircleCheck, CircleX, Clock, FolderPlus, Images, RefreshCw, Square, SquareCheck, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../auth';
import { Modal } from '../ui/Modal';
import { EmptyState, ErrorNotice, PageTitle, Spinner } from '../ui/misc';
import { errorMessage, useConfirm, useToast } from '../ui/feedback';
import {
  galleryApi,
  isValidFolderName,
  largeUrl,
  thumbUrl,
  uploadImage,
  validateUploadFile,
  type GalleryFolder,
  type GalleryImage,
} from '../../lib/gallery';

type Filter = 'alle' | 'ausstehend' | 'freigegeben';

export function GalleryPage() {
  const auth = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  const [folders, setFolders] = useState<GalleryFolder[] | null>(null);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [folder, setFolder] = useState('');
  const [images, setImages] = useState<GalleryImage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('alle');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<GalleryImage | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadFolders = useCallback(async () => {
    setFoldersError(null);
    try {
      const api = await galleryApi();
      const list = await api.listFolders();
      setFolders(list.sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true })));
    } catch (err) {
      setFoldersError(errorMessage(err));
      setFolders([]);
    }
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const loadImages = useCallback(
    async (name: string) => {
      setSelected(new Set());
      if (!name) {
        setImages(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const api = await galleryApi();
        const token = await auth.getToken();
        setImages(await api.adminImages(name, token));
      } catch (err) {
        setImages(null);
        setError(`Fehler beim Laden der Bilder: ${errorMessage(err)}`);
      } finally {
        setLoading(false);
      }
    },
    [auth],
  );

  useEffect(() => {
    void loadImages(folder);
  }, [folder, loadImages]);

  const visible = useMemo(
    () =>
      (images ?? []).filter((img) =>
        filter === 'alle' ? true : filter === 'freigegeben' ? img.approved : !img.approved,
      ),
    [images, filter],
  );
  const counts = useMemo(() => {
    const list = images ?? [];
    const approved = list.filter((i) => i.approved).length;
    return { alle: list.length, freigegeben: approved, ausstehend: list.length - approved };
  }, [images]);

  function toggle(id: string) {
    setSelected((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(action: 'approve' | 'unapprove' | 'remove') {
    if (selected.size === 0) {
      toast.error('Bitte wähle mindestens ein Bild aus.');
      return;
    }
    const ids = [...selected];
    const texts = {
      approve: { title: 'Bilder freigeben?', message: `Möchtest du ${ids.length} Bild(er) freigeben?`, label: 'Freigeben' },
      unapprove: {
        title: 'Freigabe entfernen?',
        message: `Möchtest du die Freigabe von ${ids.length} Bild(ern) entfernen?`,
        label: 'Freigabe entfernen',
      },
      remove: {
        title: '⚠️ Bilder endgültig löschen?',
        message: `Möchtest du ${ids.length} Bild(er) PERMANENT löschen? Diese Aktion kann nicht rückgängig gemacht werden!`,
        label: 'Endgültig löschen',
      },
    }[action];
    const ok = await confirm({
      title: texts.title,
      message: texts.message,
      confirmLabel: texts.label,
      tone: action === 'remove' ? 'danger' : 'default',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const api = await galleryApi();
      const token = await auth.getToken();
      const count = await api[action](ids, token);
      toast.success(
        action === 'approve'
          ? `✅ ${count} Bild(er) erfolgreich freigegeben!`
          : action === 'unapprove'
            ? `Freigabe von ${count} Bild(ern) erfolgreich entfernt!`
            : `${count} Bild(er) erfolgreich gelöscht!`,
      );
      await loadImages(folder);
    } catch (err) {
      toast.error(`Fehler: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Galerie verwalten"
        description="Hier kannst du Bilder von Veranstaltungen freigeben oder die Freigabe entfernen. Nur freigegebene Bilder erscheinen öffentlich."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setUploadOpen(true)}>
            <Upload aria-hidden="true" /> Bilder hochladen
          </button>
        }
      />

      {!auth.isAdmin && (
        <ErrorNotice>Für die Galerie-Verwaltung wird das Vorstandsrecht („admin“) benötigt.</ErrorNotice>
      )}

      <div className="toolbar">
        <div className="field toolbar__field">
          <label className="label" htmlFor="admin-folder">
            Veranstaltung auswählen:
          </label>
          <select
            id="admin-folder"
            className="select"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            disabled={folders === null}
          >
            <option value="">{folders === null ? '-- Lade Veranstaltungen... --' : '-- Bitte wählen --'}</option>
            {folders?.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
                {typeof f.totalCount === 'number' ? ` (${f.totalCount})` : ''}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => { void loadFolders(); void loadImages(folder); }}>
          <RefreshCw aria-hidden="true" /> Aktualisieren
        </button>
      </div>
      {foldersError && <ErrorNotice>Fehler beim Laden der Ordner: {foldersError}</ErrorNotice>}

      {!folder ? (
        <EmptyState icon={<Images aria-hidden="true" />} title="Bitte wähle eine Veranstaltung aus." />
      ) : loading ? (
        <Spinner label="Lade Bilder..." />
      ) : error ? (
        <ErrorNotice>{error}</ErrorNotice>
      ) : !images?.length ? (
        <EmptyState icon={<Images aria-hidden="true" />} title="Keine Bilder für diese Veranstaltung gefunden." />
      ) : (
        <>
          <div className="segmented" role="tablist" aria-label="Filter">
            {(['alle', 'ausstehend', 'freigegeben'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={filter === f ? 'is-active' : undefined}
                onClick={() => setFilter(f)}
              >
                {f === 'alle' ? 'Alle' : f === 'ausstehend' ? 'Ausstehend' : 'Freigegeben'} ({counts[f]})
              </button>
            ))}
          </div>

          <div className="action-bar">
            <span className="action-bar__count">{selected.size} ausgewählt</span>
            <button type="button" className="btn btn--sm" onClick={() => setSelected(new Set(visible.map((i) => i.public_id)))}>
              <SquareCheck aria-hidden="true" /> Alle auswählen
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setSelected(new Set())}>
              <Square aria-hidden="true" /> Alle abwählen
            </button>
            <span className="action-bar__spacer" />
            <button type="button" className="btn btn--sm btn--primary" disabled={busy || !selected.size} onClick={() => run('approve')}>
              <CheckCheck aria-hidden="true" /> Ausgewählte freigeben
            </button>
            <button type="button" className="btn btn--sm" disabled={busy || !selected.size} onClick={() => run('unapprove')}>
              <CircleX aria-hidden="true" /> Freigabe entfernen
            </button>
            <button type="button" className="btn btn--sm btn--danger" disabled={busy || !selected.size} onClick={() => run('remove')}>
              <Trash2 aria-hidden="true" /> Ausgewählte löschen
            </button>
          </div>

          <ul role="list" className="admin-gallery">
            {visible.map((img) => {
              const isSelected = selected.has(img.public_id);
              return (
                <li key={img.public_id} className={`admin-photo${isSelected ? ' is-selected' : ''}`}>
                  <label className="admin-photo__check">
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(img.public_id)} />
                    <span className="visually-hidden">Bild auswählen</span>
                  </label>
                  <span className={`badge admin-photo__status ${img.approved ? 'badge--success' : 'badge--warning'}`}>
                    {img.approved ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />}
                    {img.approved ? 'Freigegeben' : 'Ausstehend'}
                  </span>
                  <button type="button" className="admin-photo__image" onClick={() => setPreview(img)} aria-label="Bild groß anzeigen">
                    <img src={thumbUrl(img.secure_url)} alt="" loading="lazy" decoding="async" />
                  </button>
                  <span className="admin-photo__date">{new Date(img.created_at).toLocaleDateString('de-DE')}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Bildvorschau" size="l">
        {preview && <img className="preview-image" src={largeUrl(preview.secure_url)} alt="" />}
      </Modal>

      <AdminUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folders={folders ?? []}
        initialFolder={folder}
        onDone={async (target) => {
          await loadFolders();
          setFolder(target);
          await loadImages(target);
        }}
      />
    </>
  );
}

function AdminUpload({
  open,
  onClose,
  folders,
  initialFolder,
  onDone,
}: {
  open: boolean;
  onClose(): void;
  folders: GalleryFolder[];
  initialFolder: string;
  onDone(folder: string): Promise<void>;
}) {
  const toast = useToast();
  const [target, setTarget] = useState(initialFolder);
  const [newFolder, setNewFolder] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTarget(initialFolder);
      setNewFolder('');
      setFiles([]);
    }
  }, [open, initialFolder]);

  const folderName = target === '__neu__' ? newFolder.trim() : target;
  const folderValid = target === '__neu__' ? isValidFolderName(newFolder) : !!target;

  async function upload() {
    const valid = files.filter((f) => !validateUploadFile(f));
    if (!valid.length || !folderValid) return;
    let done = 0;
    let failed = 0;
    for (const file of valid) {
      setProgress(`Lade ${done + failed + 1} von ${valid.length} hoch…`);
      try {
        await uploadImage(file, folderName, () => undefined);
        done++;
      } catch {
        failed++;
      }
    }
    setProgress(null);
    if (failed) toast.error(`${failed} Bild(er) konnten nicht hochgeladen werden.`);
    if (done) toast.success(`${done} Bild(er) hochgeladen – sie sind noch nicht freigegeben.`);
    onClose();
    await onDone(folderName);
  }

  const invalid = files.map((f) => ({ file: f, error: validateUploadFile(f) })).filter((x) => x.error);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bilder hochladen"
      description="Hochgeladene Bilder sind zunächst „ausstehend“ und müssen noch freigegeben werden."
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={!!progress}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={upload}
            disabled={!!progress || !folderValid || files.length === 0 || invalid.length === files.length}
          >
            <Upload aria-hidden="true" /> {progress ?? 'Hochladen'}
          </button>
        </>
      }
    >
      <div className="form">
        <div className="field">
          <label className="label" htmlFor="up-folder">
            Ordner (Veranstaltung)
          </label>
          <select id="up-folder" className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">-- Bitte wählen --</option>
            {folders.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
            <option value="__neu__">➕ Neuer Ordner…</option>
          </select>
        </div>
        {target === '__neu__' && (
          <div className="field">
            <label className="label" htmlFor="up-new">
              <FolderPlus aria-hidden="true" className="inline-icon" /> Name des neuen Ordners
            </label>
            <input
              id="up-new"
              className="input"
              placeholder="z.B. Weihnachtsschießen 2026"
              value={newFolder}
              aria-invalid={!!newFolder && !isValidFolderName(newFolder)}
              onChange={(e) => setNewFolder(e.target.value)}
            />
            <span className="hint">Erlaubt sind Buchstaben, Ziffern, Leerzeichen sowie - _ und Punkt.</span>
          </div>
        )}
        <div className="field">
          <span className="label">Bilder</span>
          <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
            <Images aria-hidden="true" /> Bilder auswählen
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
            className="visually-hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && <span className="hint">{files.length} Datei(en) ausgewählt</span>}
          {invalid.map(({ file, error }) => (
            <span key={file.name} className="hint hint--error">
              {file.name}: {error}
            </span>
          ))}
        </div>
      </div>
    </Modal>
  );
}
