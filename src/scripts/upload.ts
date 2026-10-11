import { galleryApi, uploadImage, UPLOAD_LIMITS, validateUploadFile } from '../lib/gallery';

interface QueueEntry {
  file: File;
  error: string | null;
  status: 'wartet' | 'laedt' | 'fertig' | 'fehler';
  row: HTMLLIElement;
  meta: HTMLElement;
  progress: HTMLProgressElement;
  previewUrl: string;
}

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

export function initUpload() {
  const form = document.querySelector<HTMLFormElement>('[data-upload]');
  if (!form) return;
  const select = form.querySelector<HTMLSelectElement>('[data-upload-folder]')!;
  const input = form.querySelector<HTMLInputElement>('[data-upload-input]')!;
  const dropzone = form.querySelector<HTMLElement>('[data-dropzone]')!;
  const queueList = form.querySelector<HTMLUListElement>('[data-upload-queue]')!;
  const consent = form.querySelector<HTMLInputElement>('[data-upload-consent]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-upload-submit]')!;
  const errorBox = form.querySelector<HTMLElement>('[data-upload-error]')!;
  const success = form.querySelector<HTMLElement>('[data-upload-success]')!;

  let queue: QueueEntry[] = [];
  let uploading = false;

  const pending = () => queue.filter((q) => !q.error && q.status !== 'fertig');

  function updateButton() {
    submit.disabled = uploading || !select.value || !consent.checked || pending().length === 0;
  }

  function showError(text: string) {
    errorBox.textContent = text;
    errorBox.hidden = !text;
  }

  async function loadFolders() {
    try {
      const api = await galleryApi();
      const folders = (await api.listFolders()).sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
      if (!folders.length) {
        select.replaceChildren(new Option('-- Keine Veranstaltungen verfügbar --', ''));
        return;
      }
      select.replaceChildren(new Option('-- Bitte wählen --', ''), ...folders.map((f) => new Option(f.name, f.name)));
      const preset = new URLSearchParams(location.search).get('ordner');
      if (preset && folders.some((f) => f.name === preset)) select.value = preset;
    } catch (error) {
      console.error(error);
      select.replaceChildren(new Option('-- Fehler beim Laden --', ''));
    }
    updateButton();
  }

  function addFiles(files: FileList | File[]) {
    success.hidden = true;
    showError('');
    const list = Array.from(files);
    const free = UPLOAD_LIMITS.maxFiles - pending().length;
    if (list.length > free) {
      showError(`Es können höchstens ${UPLOAD_LIMITS.maxFiles} Bilder auf einmal hochgeladen werden.`);
    }
    for (const file of list.slice(0, Math.max(free, 0))) {
      const error = validateUploadFile(file);
      const row = document.createElement('li');
      row.className = 'queue__item';
      const thumb = document.createElement('img');
      thumb.className = 'queue__thumb';
      thumb.alt = '';
      const previewUrl = error ? '' : URL.createObjectURL(file);
      if (previewUrl) thumb.src = previewUrl;
      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'queue__name';
      name.textContent = file.name;
      const meta = document.createElement('div');
      meta.className = 'queue__meta';
      meta.textContent = error ?? formatSize(file.size);
      if (error) meta.classList.add('is-error');
      const progress = document.createElement('progress');
      progress.max = 1;
      progress.value = 0;
      progress.hidden = true;
      info.append(name, meta, progress);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--ghost btn--sm';
      remove.textContent = 'Entfernen';
      remove.setAttribute('aria-label', `${file.name} entfernen`);
      const entry: QueueEntry = { file, error, status: 'wartet', row, meta, progress, previewUrl };
      remove.addEventListener('click', () => {
        if (uploading) return;
        queue = queue.filter((q) => q !== entry);
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
        row.remove();
        updateButton();
      });
      row.append(thumb, info, remove);
      queueList.append(row);
      queue.push(entry);
    }
    updateButton();
  }

  input.addEventListener('change', () => {
    if (input.files) addFiles(input.files);
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach((type) =>
    dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    }),
  );
  ['dragleave', 'drop'].forEach((type) =>
    dropzone.addEventListener(type, () => dropzone.classList.remove('is-dragover')),
  );
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  });

  select.addEventListener('change', () => {
    success.hidden = true;
    updateButton();
  });
  consent.addEventListener('change', updateButton);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!select.value) return showError('Bitte wähle zuerst eine Veranstaltung aus!');
    if (!consent.checked) return showError('Bitte bestätige den Datenschutz-Hinweis.');
    const todo = pending();
    if (!todo.length) return;

    uploading = true;
    showError('');
    updateButton();
    submit.textContent = 'Wird hochgeladen…';

    let failed = 0;
    const folder = select.value;
    // Fehlgeschlagene Bilder aus einem vorherigen Versuch werden erneut hochgeladen.
    todo.forEach((entry) => {
      entry.status = 'wartet';
      entry.meta.classList.remove('is-error');
    });
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const entry = todo[next++]!;
        entry.status = 'laedt';
        entry.progress.value = 0;
        entry.progress.hidden = false;
        entry.meta.textContent = 'Wird hochgeladen…';
        try {
          await uploadImage(entry.file, folder, (fraction) => (entry.progress.value = fraction));
          entry.status = 'fertig';
          entry.meta.textContent = 'Hochgeladen ✓';
          entry.meta.classList.add('is-done');
        } catch (error) {
          failed++;
          entry.status = 'fehler';
          entry.meta.textContent = error instanceof Error ? error.message : 'Fehler beim Hochladen';
          entry.meta.classList.add('is-error');
        } finally {
          entry.progress.hidden = true;
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    uploading = false;
    submit.textContent = 'Bilder hochladen';
    const done = queue.filter((q) => q.status === 'fertig');
    if (failed === 0 && done.length) {
      success.hidden = false;
      consent.checked = false;
      setTimeout(() => {
        queue.forEach((q) => q.previewUrl && URL.revokeObjectURL(q.previewUrl));
        queue = [];
        queueList.replaceChildren();
        updateButton();
      }, 2500);
    } else if (failed) {
      showError(`${failed} Bild(er) konnten nicht hochgeladen werden. Bitte erneut versuchen.`);
    }
    updateButton();
  });

  void loadFolders();
}
