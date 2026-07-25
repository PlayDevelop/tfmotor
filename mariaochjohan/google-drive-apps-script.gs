const FOLDER_ID = "PASTE_GOOGLE_DRIVE_FOLDER_ID_HERE";
const UPLOAD_TOKEN = "PASTE_A_LONG_RANDOM_TOKEN_HERE";
const MAX_FILE_SIZE = 12 * 1024 * 1024;
const MAX_BATCH_SIZE = 4;
const PHOTO_CACHE_KEY = "wedding-photo-list-v3";
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function doGet(event) {
  try {
    const payload = { photos: listPhotos() };
    const callback = event && event.parameter ? event.parameter.callback : "";
    return callback ? jsonp(callback, payload) : json(payload);
  } catch (error) {
    const payload = { error: readableError(error) };
    const callback = event && event.parameter ? event.parameter.callback : "";
    return callback ? jsonp(callback, payload) : json(payload);
  }
}

function doPost(event) {
  let requestId = "";

  try {
    const rawPayload =
      event && event.parameter && event.parameter.payload
        ? event.parameter.payload
        : event && event.postData
          ? event.postData.contents
          : "{}";
    const payload = JSON.parse(rawPayload || "{}");
    requestId = cleanText(payload.requestId, 100);

    if (payload.token !== UPLOAD_TOKEN) {
      throw new Error("Felaktig uppladdningsnyckel.");
    }
    const photos = Array.isArray(payload.photos) ? payload.photos : payload.photo ? [payload.photo] : [];
    if (!photos.length) {
      throw new Error("Ingen bild skickades.");
    }
    if (photos.length > MAX_BATCH_SIZE) {
      throw new Error("För många bilder skickades samtidigt.");
    }

    const guestName = cleanText(payload.guestName, 60);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const uploadedPhotos = photos.map(function (photo) {
      const mimeType = cleanText(photo.mimeType, 100).toLowerCase();
      if (!ALLOWED_TYPES[mimeType]) {
        throw new Error("Bildformatet stöds inte.");
      }

      const bytes = Utilities.base64Decode(String(photo.data || ""));
      if (!bytes.length || bytes.length > MAX_FILE_SIZE) {
        throw new Error("Bilden är tom eller större än 12 MB.");
      }

      const originalName = cleanText(photo.name, 120) || "bröllopsbild";
      const filename =
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss") +
        "-" +
        Utilities.getUuid().slice(0, 8) +
        "-" +
        safeFilename(originalName, ALLOWED_TYPES[mimeType]);
      const blob = Utilities.newBlob(bytes, mimeType, filename);
      const file = folder.createFile(blob);
      const metadata = {
        caption: guestName ? "Uppladdad av " + guestName : "Uppladdad bild",
        uploadedAt: new Date().toISOString(),
      };

      file.setDescription(JSON.stringify(metadata));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return publicPhoto(file, metadata);
    });
    updatePhotoCache(uploadedPhotos);

    return messageResponse(
      {
        ok: true,
        photo: uploadedPhotos[0] || null,
        photos: uploadedPhotos,
      },
      requestId,
    );
  } catch (error) {
    return messageResponse(
      {
        ok: false,
        error: readableError(error),
      },
      requestId,
    );
  }
}

function listPhotos() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PHOTO_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      cache.remove(PHOTO_CACHE_KEY);
    }
  }

  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files = folder.getFiles();
  const photos = [];

  while (files.hasNext()) {
    const file = files.next();
    if (String(file.getMimeType()).indexOf("image/") !== 0) {
      continue;
    }
    photos.push(publicPhoto(file));
  }

  photos.sort(function (left, right) {
    return String(right.uploadedAt).localeCompare(String(left.uploadedAt));
  });
  const serialized = JSON.stringify(photos);
  if (serialized.length < 90000) {
    cache.put(PHOTO_CACHE_KEY, serialized, 300);
  }
  return photos;
}

function publicPhoto(file, knownMetadata) {
  let metadata = knownMetadata || {};
  if (!knownMetadata) {
    try {
      metadata = JSON.parse(file.getDescription() || "{}");
    } catch (error) {
      metadata = {};
    }
  }

  const id = file.getId();
  const resourceKey = typeof file.getResourceKey === "function" ? file.getResourceKey() || "" : "";
  return {
    id: id,
    resourceKey: resourceKey,
    caption: metadata.caption || "Uppladdad bild",
    uploadedAt: metadata.uploadedAt || file.getDateCreated().toISOString(),
  };
}

function updatePhotoCache(newPhotos) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PHOTO_CACHE_KEY);
  if (!cached) {
    return;
  }

  try {
    const existing = JSON.parse(cached);
    const seen = {};
    const merged = newPhotos.concat(Array.isArray(existing) ? existing : []).filter(function (photo) {
      const key = photo.id || photo.originalUrl || photo.url;
      if (!key || seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    });
    const serialized = JSON.stringify(merged);
    if (serialized.length < 90000) {
      cache.put(PHOTO_CACHE_KEY, serialized, 300);
    } else {
      cache.remove(PHOTO_CACHE_KEY);
    }
  } catch (error) {
    cache.remove(PHOTO_CACHE_KEY);
  }
}

function safeFilename(value, extension) {
  const base = String(value)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9åäöÅÄÖ_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return (base || "bröllopsbild") + "." + extension;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function readableError(error) {
  const message = error && error.message ? String(error.message) : "Okänt fel.";
  if (message.indexOf("Access denied") !== -1 || message.indexOf("permissions") !== -1) {
    return "Google-kontot tillåter inte publik bildvisning.";
  }
  return message;
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function jsonp(callback, payload) {
  if (!/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(String(callback || ""))) {
    return json({ error: "Ogiltigt callback-namn." });
  }
  return ContentService.createTextOutput(callback + "(" + JSON.stringify(payload) + ");").setMimeType(
    ContentService.MimeType.JAVASCRIPT,
  );
}

function messageResponse(payload, requestId) {
  const message = {
    source: "maria-johan-drive",
    requestId: requestId,
    ok: Boolean(payload.ok),
    error: payload.error || "",
    photo: payload.photo || null,
    photos: payload.photos || [],
  };
  const serialized = JSON.stringify(message).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput(
    "<!doctype html><meta charset=\"utf-8\"><script>window.top.postMessage(" +
      serialized +
      ", \"*\");</script>",
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
