const API_URL = "api.php";
const driveConfig = window.WEDDING_DRIVE || {};
const DRIVE_URL = typeof driveConfig.endpoint === "string" ? driveConfig.endpoint.trim() : "";
const DRIVE_TOKEN = typeof driveConfig.uploadToken === "string" ? driveConfig.uploadToken : "";
const DRIVE_MAX_FILE_SIZE = (Number(driveConfig.maxFileSizeMb) || 12) * 1024 * 1024;
const DRIVE_UPLOAD_CONCURRENCY = 2;
const DRIVE_UPLOAD_BATCH_SIZE = 3;
const UPLOAD_MAX_DIMENSION = 1920;
const UPLOAD_JPEG_QUALITY = 0.76;
const UPLOAD_MIN_JPEG_QUALITY = 0.6;
const UPLOAD_TARGET_SIZE = 900 * 1024;
const DRIVE_GALLERY_CACHE_KEY = "maria-johan-drive-gallery-v3";
const GALLERY_PAGE_SIZE = 24;
const usesGoogleDrive = driveConfig.storage === "drive" && Boolean(DRIVE_URL);
const seedPhotos = [
  { url: "assets/photos/hero.jpg", caption: "Maria & Johan" },
  { url: "assets/photos/moment-1.jpg", caption: "Maria & Johan" },
  { url: "assets/photos/moment-2.jpg", caption: "Maria & Johan" },
  { url: "assets/photos/moment-3.jpg", caption: "Maria & Johan" },
  { url: "assets/photos/moment-4.jpg", caption: "Maria & Johan" },
  { url: "assets/photos/moment-5.jpg", caption: "Maria & Johan" },
];
const isStaticPreview = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);

const form = document.querySelector("#uploadForm");
const input = document.querySelector("#photoInput");
const dropZone = document.querySelector("#dropZone");
const selectedFiles = document.querySelector("#selectedFiles");
const statusText = document.querySelector("#uploadStatus");
const gallery = document.querySelector("#gallery");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxCaption = document.querySelector("#lightboxCaption");
const closeLightbox = document.querySelector("#closeLightbox");
const uploadButton = document.querySelector("#uploadButton");
const uploadProgress = document.querySelector("#uploadProgress");
const progressBar = document.querySelector("#progressBar");
const progressLabel = document.querySelector("#progressLabel");
const progressPercent = document.querySelector("#progressPercent");
const loadMoreButton = document.querySelector("#loadMoreButton");

let apiAvailable = true;
let visibleUploadCount = GALLERY_PAGE_SIZE;
let currentUploadedPhotos = [];

document.addEventListener("DOMContentLoaded", () => {
  renderWeddingGallery(usesGoogleDrive ? getCachedDrivePhotos() : [], true);
  void loadGallery();
});

input.addEventListener("change", () => {
  renderSelectedFiles(input.files);
  resetUploadProgress();
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
  });
});

dropZone.addEventListener("drop", (event) => {
  const files = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  renderSelectedFiles(input.files);
  resetUploadProgress();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = Array.from(input.files || []);
  if (!files.length) {
    setStatus("Välj minst en bild först.");
    return;
  }

  setStatus("Laddar upp...");
  uploadButton.disabled = true;
  input.disabled = true;
  form.setAttribute("aria-busy", "true");
  beginUploadProgress(files.length);

  try {
    let uploadedPhotos = [];
    if (usesGoogleDrive) {
      uploadedPhotos = await uploadToDrive(files);
    } else if (apiAvailable) {
      uploadedPhotos = await uploadToServer(files);
    } else {
      await saveLocalPreview(files);
    }
    finishUploadProgress(files.length);
    form.reset();
    renderSelectedFiles([]);
    setStatus("Tack! Bilderna är uppladdade.");
    if (uploadedPhotos.length) {
      const mergedPhotos = mergeUploadedPhotos(uploadedPhotos, currentUploadedPhotos);
      if (usesGoogleDrive) {
        cacheDrivePhotos(mergedPhotos);
      }
      renderWeddingGallery(mergedPhotos);
    } else {
      await loadGallery();
    }
  } catch (error) {
    failUploadProgress();
    setStatus(error.message || "Bilderna kunde inte laddas upp.");
  } finally {
    uploadButton.disabled = false;
    input.disabled = false;
    form.removeAttribute("aria-busy");
  }
});

closeLightbox.addEventListener("click", () => {
  lightbox.close();
});

loadMoreButton.addEventListener("click", () => {
  visibleUploadCount += GALLERY_PAGE_SIZE;
  renderWeddingGallery(currentUploadedPhotos);
});

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    lightbox.close();
  }
});

lightboxImage.addEventListener("error", () => {
  const fallbackUrl = lightboxImage.dataset.fallbackUrl;
  if (!fallbackUrl || lightboxImage.dataset.fallbackUsed === "true") {
    return;
  }
  lightboxImage.dataset.fallbackUsed = "true";
  lightboxImage.src = fallbackUrl;
});

async function loadGallery() {
  if (usesGoogleDrive) {
    try {
      const payload = await loadDrivePhotos();
      const photos = Array.isArray(payload.photos) ? payload.photos : [];
      cacheDrivePhotos(photos);
      renderWeddingGallery(photos, true);
      if (!statusText.textContent) {
        setStatus("Bilderna sparas i det gemensamma bröllopsgalleriet.");
      }
    } catch {
      renderWeddingGallery(getCachedDrivePhotos());
      setStatus("Google Drive kunde inte nås just nu. Försök igen om en stund.");
    }
    return;
  }

  if (isStaticPreview) {
    apiAvailable = false;
    const localPhotos = await getLocalPreviewPhotos();
    renderWeddingGallery(localPhotos);
    if (!statusText.textContent) {
      setStatus("Lokalt förhandsläge: bilder sparas bara i den här webbläsaren.");
    }
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ action: "list" }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Kunde inte läsa galleriet.");
    apiAvailable = true;
    renderWeddingGallery(payload.photos);
  } catch {
    apiAvailable = false;
    const localPhotos = await getLocalPreviewPhotos();
    renderWeddingGallery(localPhotos);
    setStatus("Lokalt förhandsläge: bilder sparas bara i den här webbläsaren.");
  }
}

async function uploadToDrive(files) {
  if (!DRIVE_TOKEN) {
    throw new Error("Google Drive är inte färdigkonfigurerat.");
  }

  const guestName = document.querySelector("#guestName").value.trim();
  const totalPhases = files.length * 2;
  const batches = [];
  for (let index = 0; index < files.length; index += DRIVE_UPLOAD_BATCH_SIZE) {
    batches.push(
      files.slice(index, index + DRIVE_UPLOAD_BATCH_SIZE).map((file, batchIndex) => ({
        file,
        index: index + batchIndex,
      })),
    );
  }

  let nextBatchIndex = 0;
  let completedFiles = 0;
  let completedPhases = 0;
  let firstError = null;
  const uploadedPhotos = [];

  async function worker() {
    while (!firstError) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      if (batchIndex >= batches.length) {
        return;
      }

      const batch = batches[batchIndex];
      try {
        const photos = [];
        for (const item of batch) {
          setSelectedFileStatus(item.index, "Förbereder");
          await waitForPaint();
          const file = await optimizeImageForUpload(item.file);
          if (file.size > DRIVE_MAX_FILE_SIZE) {
            throw new Error(
              `${item.file.name} är större än ${Math.round(DRIVE_MAX_FILE_SIZE / 1024 / 1024)} MB efter optimering.`,
            );
          }

          const dataUrl = await fileToDataUrl(file);
          photos.push({
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            data: String(dataUrl).split(",")[1] || "",
          });
          completedPhases += 1;
          setSelectedFileStatus(item.index, `Laddar upp · ${formatSize(file.size)}`);
          updateUploadProgress(completedPhases, totalPhases, completedFiles, files.length);
        }

        const response = await submitDrivePhoto({
          action: "upload",
          token: DRIVE_TOKEN,
          guestName,
          requestId: createRequestId(),
          photos,
        });

        const responsePhotos = Array.isArray(response.photos)
          ? response.photos
          : response.photo
            ? [response.photo]
            : [];
        uploadedPhotos.push(...responsePhotos);
        for (const item of batch) {
          completedFiles += 1;
          completedPhases += 1;
          setSelectedFileStatus(item.index, "Klar", "is-complete");
        }
        updateUploadProgress(completedPhases, totalPhases, completedFiles, files.length);
      } catch (error) {
        firstError = error;
        batch.forEach((item) => {
          setSelectedFileStatus(item.index, "Misslyckades", "is-error");
        });
      }
    }
  }

  const workerCount = Math.min(DRIVE_UPLOAD_CONCURRENCY, batches.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (firstError) {
    throw firstError;
  }
  return uploadedPhotos.sort((left, right) =>
    String(right.uploadedAt || "").localeCompare(String(left.uploadedAt || "")),
  );
}

function loadDrivePhotos() {
  return new Promise((resolve, reject) => {
    const callbackName = `mariaJohanDrive_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(DRIVE_URL, window.location.href);
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Drive svarade inte."));
    }, 30000);

    function cleanup() {
      window.clearTimeout(timeout);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = (payload) => {
      cleanup();
      if (payload && payload.error) {
        reject(new Error(payload.error));
        return;
      }
      resolve(payload || { photos: [] });
    };

    url.searchParams.set("action", "list");
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("_", Date.now());
    script.src = url.toString();
    script.referrerPolicy = "no-referrer";
    script.onerror = () => {
      cleanup();
      reject(new Error("Google Drive kunde inte läsas."));
    };
    document.head.appendChild(script);
  });
}

function submitDrivePhoto(payload) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    const formElement = document.createElement("form");
    const payloadInput = document.createElement("input");
    const frameName = `driveUpload_${payload.requestId}`;
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Uppladdningen tog för lång tid."));
    }, 120000);

    function cleanup() {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
      formElement.remove();
      frame.remove();
    }

    function handleMessage(event) {
      const message = event.data;
      if (
        !isTrustedDriveMessageOrigin(event.origin) ||
        !message ||
        message.source !== "maria-johan-drive" ||
        message.requestId !== payload.requestId
      ) {
        return;
      }

      cleanup();
      if (!message.ok) {
        reject(new Error(message.error || "Uppladdningen misslyckades."));
        return;
      }
      resolve(message);
    }

    frame.name = frameName;
    frame.hidden = true;
    frame.setAttribute("aria-hidden", "true");

    formElement.method = "POST";
    formElement.action = DRIVE_URL;
    formElement.target = frameName;
    formElement.hidden = true;

    payloadInput.type = "hidden";
    payloadInput.name = "payload";
    payloadInput.value = JSON.stringify(payload);
    formElement.appendChild(payloadInput);

    window.addEventListener("message", handleMessage);
    document.body.append(frame, formElement);
    formElement.submit();
  });
}

function isTrustedDriveMessageOrigin(origin) {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "script.google.com" || hostname.endsWith("script.googleusercontent.com");
  } catch {
    return false;
  }
}

async function uploadToServer(files) {
  const optimizedFiles = [];
  const preparationWeight = 20;

  for (let index = 0; index < files.length; index += 1) {
    setSelectedFileStatus(index, "Förbereder");
    await waitForPaint();
    const optimized = await optimizeImageForUpload(files[index]);
    optimizedFiles.push(optimized);
    setSelectedFileStatus(index, `Redo · ${formatSize(optimized.size)}`);
    setProgress(
      Math.round(((index + 1) / files.length) * preparationWeight),
      `Förbereder ${index + 1} av ${files.length}`,
    );
  }

  const data = new FormData();
  data.set("action", "upload");
  data.set("guestName", document.querySelector("#guestName").value.trim());
  optimizedFiles.forEach((file) => data.append("photos[]", file, file.name));

  const payload = await postPhotosWithProgress(data, (ratio) => {
    const percent = preparationWeight + Math.round(ratio * 75);
    setProgress(percent, `Laddar upp ${files.length === 1 ? "bilden" : `${files.length} bilder`}`);
  });

  files.forEach((_, index) => setSelectedFileStatus(index, "Klar", "is-complete"));
  setProgress(98, "Skapar galleribilder");
  return Array.isArray(payload.photos) ? payload.photos : [];
}

function postPhotosWithProgress(data, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", API_URL);
    request.timeout = 120000;

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    });

    request.addEventListener("load", () => {
      let payload = null;
      try {
        payload = JSON.parse(request.responseText || "{}");
      } catch {
        payload = null;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error((payload && payload.error) || "Uppladdningen misslyckades."));
        return;
      }
      resolve(payload || {});
    });

    request.addEventListener("timeout", () => reject(new Error("Uppladdningen tog för lång tid.")));
    request.addEventListener("error", () => reject(new Error("Nätverksfel under uppladdningen.")));
    request.send(data);
  });
}

async function saveLocalPreview(files) {
  const existing = await getLocalPreviewPhotos();
  const guestName = document.querySelector("#guestName").value.trim();
  const converted = await Promise.all(
    files.map(async (file) => ({
      url: await fileToDataUrl(file),
      caption: guestName ? `Uppladdad av ${guestName}` : "Uppladdad bild",
      uploadedAt: new Date().toISOString(),
    })),
  );
  localStorage.setItem("maria-johan-preview-photos", JSON.stringify([...converted, ...existing].slice(0, 60)));
}

async function getLocalPreviewPhotos() {
  try {
    const photos = JSON.parse(localStorage.getItem("maria-johan-preview-photos") || "[]");
    return Array.isArray(photos) ? photos : [];
  } catch {
    return [];
  }
}

function getCachedDrivePhotos() {
  try {
    const cached = JSON.parse(localStorage.getItem(DRIVE_GALLERY_CACHE_KEY) || "[]");
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
}

function cacheDrivePhotos(photos) {
  try {
    localStorage.setItem(DRIVE_GALLERY_CACHE_KEY, JSON.stringify(photos.slice(0, 1000)));
  } catch {
    // The gallery still works without a local metadata cache.
  }
}

function mergeUploadedPhotos(newPhotos, existingPhotos) {
  const seen = new Set();
  return [...newPhotos, ...existingPhotos].filter((photo) => {
    const key = photo.id || photo.originalUrl || photo.url;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function optimizeImageForUpload(file) {
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error(`${file.name} är inte en bild.`);
  }

  let decoded;
  try {
    decoded = await loadImageFile(file);
  } catch {
    return file;
  }

  try {
    const sourceWidth = decoded.image.naturalWidth;
    const sourceHeight = decoded.image.naturalHeight;
    if (!sourceWidth || !sourceHeight) {
      return file;
    }

    const scale = Math.min(1, UPLOAD_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    if (scale === 1 && file.size <= UPLOAD_TARGET_SIZE && file.type === "image/jpeg") {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(decoded.image, 0, 0, targetWidth, targetHeight);

    let quality = UPLOAD_JPEG_QUALITY;
    let blob = await canvasToBlob(canvas, "image/jpeg", quality);
    while (blob && blob.size > UPLOAD_TARGET_SIZE && quality > UPLOAD_MIN_JPEG_QUALITY) {
      quality = Math.max(UPLOAD_MIN_JPEG_QUALITY, quality - 0.08);
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }
    canvas.width = 1;
    canvas.height = 1;
    if (!blob || (blob.size >= file.size && file.size <= DRIVE_MAX_FILE_SIZE)) {
      return file;
    }

    return new File([blob], replaceFileExtension(file.name, "jpg"), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    decoded.cleanup();
  }
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    function cleanup() {
      URL.revokeObjectURL(objectUrl);
    }

    image.onload = () => resolve({ image, cleanup });
    image.onerror = () => {
      cleanup();
      reject(new Error("Bilden kunde inte förberedas."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

function replaceFileExtension(filename, extension) {
  const base = String(filename || "bröllopsbild").replace(/\.[^.]+$/, "");
  return `${base || "bröllopsbild"}.${extension}`;
}

function waitForPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createRequestId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function renderSelectedFiles(files) {
  const list = Array.from(files || []);
  selectedFiles.innerHTML = list
    .map(
      (file, index) => `
        <div class="selected-file" data-file-index="${index}">
          <span>${escapeHtml(file.name)}</span>
          <strong data-file-status>${formatSize(file.size)}</strong>
        </div>
      `,
    )
    .join("");
}

function setSelectedFileStatus(index, text, stateClass = "") {
  const row = selectedFiles.querySelector(`[data-file-index="${index}"]`);
  if (!row) {
    return;
  }
  row.classList.remove("is-complete", "is-error");
  if (stateClass) {
    row.classList.add(stateClass);
  }
  const status = row.querySelector("[data-file-status]");
  if (status) {
    status.textContent = text;
  }
}

function beginUploadProgress(totalFiles) {
  uploadProgress.hidden = false;
  uploadProgress.classList.remove("is-error");
  progressBar.value = 0;
  progressLabel.textContent = `Förbereder ${totalFiles} ${totalFiles === 1 ? "bild" : "bilder"}`;
  progressPercent.textContent = "0%";
}

function updateUploadProgress(completedPhases, totalPhases, completedFiles, totalFiles) {
  const percent = Math.min(100, Math.round((completedPhases / totalPhases) * 100));
  setProgress(percent, `${completedFiles} av ${totalFiles} klara`);
  setStatus(`Förbereder och laddar upp ${totalFiles === 1 ? "bilden" : "bilderna"}...`);
}

function setProgress(percent, label) {
  const boundedPercent = Math.max(0, Math.min(100, percent));
  progressBar.value = boundedPercent;
  progressLabel.textContent = label;
  progressPercent.textContent = `${boundedPercent}%`;
}

function finishUploadProgress(totalFiles) {
  uploadProgress.hidden = false;
  uploadProgress.classList.remove("is-error");
  progressBar.value = 100;
  progressLabel.textContent = `${totalFiles === 1 ? "Bilden är" : "Alla bilder är"} uppladdad${totalFiles === 1 ? "" : "e"}`;
  progressPercent.textContent = "100%";
}

function failUploadProgress() {
  uploadProgress.hidden = false;
  uploadProgress.classList.add("is-error");
  progressLabel.textContent = "Uppladdningen avbröts";
}

function resetUploadProgress() {
  uploadProgress.hidden = true;
  uploadProgress.classList.remove("is-error");
  progressBar.value = 0;
  progressPercent.textContent = "0%";
}

function renderWeddingGallery(uploadedPhotos, resetVisibleCount = false) {
  if (resetVisibleCount) {
    visibleUploadCount = GALLERY_PAGE_SIZE;
  }

  currentUploadedPhotos = (Array.isArray(uploadedPhotos) ? uploadedPhotos : [])
    .map(normalizeDrivePhoto)
    .filter(Boolean)
    .sort((left, right) => String(right.uploadedAt || "").localeCompare(String(left.uploadedAt || "")));
  const visibleUploads = currentUploadedPhotos.slice(0, visibleUploadCount);
  renderGallery([...seedPhotos, ...visibleUploads]);
  updateLoadMoreButton();
}

function normalizeDrivePhoto(photo) {
  if (!photo || photo.url || !photo.id) {
    return photo;
  }

  const id = encodeURIComponent(photo.id);
  const resourceQuery = photo.resourceKey ? `&resourcekey=${encodeURIComponent(photo.resourceKey)}` : "";
  return {
    ...photo,
    url: `https://lh3.googleusercontent.com/d/${id}=w1600`,
    thumbnailUrl: `https://lh3.googleusercontent.com/d/${id}=w480`,
    fallbackUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w1600${resourceQuery}`,
    thumbnailFallbackUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w480${resourceQuery}`,
    originalUrl: `https://drive.google.com/file/d/${id}/view${
      photo.resourceKey ? `?resourcekey=${encodeURIComponent(photo.resourceKey)}` : ""
    }`,
  };
}

function updateLoadMoreButton() {
  const remaining = Math.max(0, currentUploadedPhotos.length - visibleUploadCount);
  loadMoreButton.hidden = remaining === 0;
  loadMoreButton.textContent = remaining === 1 ? "Visa 1 bild till" : `Visa fler bilder · ${remaining} kvar`;
}

function renderGallery(photos) {
  if (!photos.length) {
    gallery.innerHTML = `<div class="empty-gallery">Inga bilder ännu.</div>`;
    return;
  }

  gallery.innerHTML = photos
    .map(
      (photo, index) => {
        const previewUrl = photo.thumbnailUrl || photo.url;
        const previewFallbackUrl = photo.thumbnailFallbackUrl || photo.url || photo.fallbackUrl || "";
        return `
          <button class="photo-card" type="button" data-index="${index}">
            <img
              src="${escapeAttribute(previewUrl)}"
              data-fallback-url="${escapeAttribute(previewFallbackUrl)}"
              alt="${escapeAttribute(photo.caption || "Bröllopsbild")}"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
            />
            <span>${escapeHtml(photo.caption || "Bröllopsbild")}</span>
          </button>
        `;
      },
    )
    .join("");

  gallery.querySelectorAll("img[data-fallback-url]").forEach((image) => {
    image.addEventListener("error", () => {
      const fallbackUrl = image.dataset.fallbackUrl;
      if (!fallbackUrl || image.dataset.fallbackUsed === "true") {
        return;
      }
      image.dataset.fallbackUsed = "true";
      image.src = fallbackUrl;
    });
  });

  gallery.querySelectorAll("[data-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const photo = photos[Number(button.dataset.index)];
      const previewImage = button.querySelector("img");
      const previewUrl = previewImage.currentSrc || previewImage.src;
      lightboxImage.dataset.fallbackUrl = photo.fallbackUrl || previewUrl || "";
      lightboxImage.dataset.fallbackUsed = "false";
      lightboxImage.src = photo.url || previewUrl;
      lightboxImage.alt = photo.caption || "Bröllopsbild";
      lightboxCaption.textContent = photo.caption || "";
      lightbox.showModal();
    });
  });
}

function setStatus(message) {
  statusText.textContent = message;
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
