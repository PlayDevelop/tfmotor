let USERS = [
  { username: "martin", name: "Martin", initials: "MF", color: "#173f35", admin: true },
  { username: "maria", name: "Maria", initials: "MR", color: "#6fa9b5", admin: false },
  { username: "malin", name: "Malin", initials: "MA", color: "#d66b49", admin: false },
];

const API_URL = "api.php";
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
});
const longDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const monthFormatter = new Intl.DateTimeFormat("sv-SE", {
  month: "long",
  year: "numeric",
});

let visibleMonth = startOfMonth(new Date());
let editingBookingId = null;
let selectedDate = toIsoDate(new Date());
let bookingsCache = [];
let toastTimer = null;

const icons = {
  van: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17V8.8c0-1 .8-1.8 1.8-1.8h7.9c1 0 1.8.8 1.8 1.8V17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M15.5 11H18l2 2.4V17h-4.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17h3.2m4.6 0h5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="9.4" cy="17.2" r="2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="18.5" cy="17.2" r="2" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 9.3h15M6.2 5h11.6c1.2 0 2.2 1 2.2 2.2v10.6c0 1.2-1 2.2-2.2 2.2H6.2C5 20 4 19 4 17.8V7.2C4 6 5 5 6.2 5Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.8-.6 3.8 3.8-.6L18.8 8.4l-3.2-3.2L4 16.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m14.4 6.4 3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V5.6c0-.9.7-1.6 1.6-1.6h2.8c.9 0 1.6.7 1.6 1.6V7m2.4 0-.7 11.2c-.1 1-1 1.8-2 1.8H9.3c-1.1 0-1.9-.8-2-1.8L6.6 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6.8C5.8 5 5 5.8 5 6.8v10.4c0 1 .8 1.8 1.8 1.8H10M15 8l4 4-4 4M19 12H9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.8v4.7l3 1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  map: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18.7 4.5 21V6.2L9 4m0 14.7 6 2.3m-6-2.3V4m6 17 4.5-2.2V4L15 6.2m0 14.8V6.2M15 6.2 9 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

document.addEventListener("DOMContentLoaded", () => {
  void renderApp();
});

async function renderApp() {
  try {
    const sessionResponse = await apiRequest("session");
    syncUsers(sessionResponse.users);
    if (!sessionResponse.user) {
      bookingsCache = [];
      renderLogin();
      return;
    }

    await refreshBookings();
    renderDashboard(sessionResponse.user);
  } catch (error) {
    renderBackendError(error);
  }
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-screen">
      <section class="login-visual" aria-label="Husbil vid sjö">
        <img src="assets/camper-hero.png" alt="Grå Fiat Ducato plåtis vid svensk sjö" />
        <div class="login-copy">
          <p class="eyebrow">${icons.van} Familjens plåtis</p>
          <h1>Husbilen är redo.</h1>
          <p>Boka nästa helg, justera en resa eller håll koll på vem som har nycklarna.</p>
        </div>
      </section>
      <section class="login-panel-wrap">
        <div class="login-panel">
          <div class="brand-mark">
            <span class="brand-icon">${icons.van}</span>
            <span>
              <strong>Husbilen</strong>
              <span>Bokning för familjen</span>
            </span>
          </div>
          <h2>Logga in</h2>
          <p>Samma inloggning ligger kvar på enheten tills du loggar ut.</p>
          <form id="loginForm" class="form-stack" autocomplete="on">
            <label class="field">
              <span>E-post</span>
              <input id="username" type="email" autocomplete="username" required />
            </label>
            <label class="field password-row">
              <span>Lösenord</span>
              <input id="password" type="password" autocomplete="current-password" required />
            </label>
            <p id="loginMessage" class="message" aria-live="polite"></p>
            <button class="primary-button" type="submit">${icons.logout} Logga in</button>
          </form>
        </div>
      </section>
    </main>
  `;

  document.querySelector("#loginForm").addEventListener("submit", (event) => {
    void handleLogin(event);
  });
}

function renderBackendError(error) {
  app.innerHTML = `
    <main class="login-screen">
      <section class="login-visual" aria-label="Husbil vid sjö">
        <img src="assets/camper-hero.png" alt="Grå Fiat Ducato plåtis vid svensk sjö" />
        <div class="login-copy">
          <p class="eyebrow">${icons.van} Familjens plåtis</p>
          <h1>Kalendern behöver PHP.</h1>
          <p>Den gemensamma databasen svarar inte just nu. Kör sidan via Simply/PHP för att logga in och boka.</p>
        </div>
      </section>
      <section class="login-panel-wrap">
        <div class="login-panel">
          <div class="brand-mark">
            <span class="brand-icon">${icons.van}</span>
            <span>
              <strong>Husbilen</strong>
              <span>Bokning för familjen</span>
            </span>
          </div>
          <h2>Backend saknas</h2>
          <p>${escapeHtml(error.message || "API:t kunde inte laddas.")}</p>
          <button id="retryButton" class="primary-button" type="button">${icons.calendar} Försök igen</button>
        </div>
      </section>
    </main>
  `;

  document.querySelector("#retryButton").addEventListener("click", () => {
    void renderApp();
  });
}

function renderDashboard(session) {
  const bookings = getBookings();
  const user = findUser(session.username);
  const stats = getStats(bookings);
  const editingBooking = editingBookingId ? bookings.find((booking) => booking.id === editingBookingId) : null;

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-brand">
          <span class="brand-icon">${icons.van}</span>
          <span>
            <strong>Husbilen</strong>
            <span>Familjebokning</span>
          </span>
        </div>
        <div class="topbar-actions">
          <div class="user-pill">
            <span class="avatar" style="background:${user.color}">${user.initials}</span>
            <strong>${user.name}</strong>
          </div>
          <button id="logoutButton" class="icon-button" type="button" title="Logga ut" aria-label="Logga ut">
            ${icons.logout}
          </button>
        </div>
      </header>

      <section class="hero-band">
        <img src="assets/camper-hero.png" alt="Grå Fiat Ducato plåtis vid svensk sjö" />
        <div class="hero-inner">
          <div class="hero-copy">
            <p class="section-kicker">${icons.calendar} Familjens kalender</p>
            <h1>Planera nästa tur.</h1>
            <p>Gemensam överblick för bokningar, ändringar och lediga luckor.</p>
            <div class="hero-actions">
              <button id="newBookingButton" class="primary-button" type="button">${icons.plus} Ny bokning</button>
              <button id="jumpCalendarButton" class="ghost-button" type="button">${icons.calendar} Kalender</button>
            </div>
          </div>
          <div class="hero-metrics">
            <article class="metric">
              <span>Nästa bokning</span>
              <strong>${stats.nextTitle}</strong>
              <small>${stats.nextSubtitle}</small>
            </article>
            <article class="metric">
              <span>Denna månad</span>
              <strong>${stats.monthCount}</strong>
              <small>${stats.monthSubtitle}</small>
            </article>
            <article class="metric">
              <span>Status just nu</span>
              <strong>${stats.currentTitle}</strong>
              <small>${stats.currentSubtitle}</small>
            </article>
          </div>
        </div>
      </section>

      <main class="main-grid">
        <section id="bookingFormSection" class="composer-panel">
          ${renderBookingForm(editingBooking, user)}
        </section>

        <section id="calendarSection" class="calendar-panel">
          ${renderCalendar(bookings, user)}
        </section>

        <section id="bookingListSection" class="timeline-panel">
          ${renderBookingList(bookings, user)}
        </section>

        <aside class="travel-panel">
          <div class="travel-panel-inner">
            <img src="assets/camper-interior.png" alt="Interiör i husbil med karta och kaffe" />
            <div class="travel-copy">
              <p class="section-kicker" style="color: var(--pine)">${icons.map} Familjen</p>
              <h2>Fem personer, en kalender.</h2>
              <ul class="family-row">
                ${USERS.map(
                  (familyUser) =>
                    `<li><span class="avatar" style="background:${familyUser.color}">${familyUser.initials}</span>${familyUser.name}</li>`,
                ).join("")}
              </ul>
              <ul class="quick-list">
                <li>${icons.clock} Konflikter stoppas</li>
                <li>${icons.calendar} Session sparas</li>
                <li>${icons.van} Mobilklar</li>
              </ul>
            </div>
          </div>
        </aside>
      </main>
    </div>
  `;

  bindDashboardEvents(session);
}

function renderBookingForm(editingBooking, user) {
  const values = editingBooking || getDefaultBookingValues(user);
  const submitText = editingBooking ? "Spara ändring" : "Spara bokning";
  const isAdminUser = isAdmin(user.username);

  return `
    <form id="bookingForm" class="booking-form">
      <div class="panel-heading">
        <div>
          <p class="section-kicker" style="color: var(--pine)">${icons.plus} Bokning</p>
          <h2>${editingBooking ? "Ändra tid" : "Boka tid"}</h2>
        </div>
      </div>
      <input id="bookingId" type="hidden" value="${editingBooking ? editingBooking.id : ""}" />
      <div class="form-grid">
        <label class="field wide">
          <span>Rubrik</span>
          <input id="title" type="text" value="${escapeAttribute(values.title)}" maxlength="64" placeholder="Sommarvecka, service, helgtur..." />
        </label>
        <label class="field">
          <span>Startdatum</span>
          <input id="startDate" type="date" value="${values.startDate}" required />
        </label>
        <label class="field">
          <span>Starttid</span>
          <input id="startTime" type="time" value="${values.startTime}" required />
        </label>
        <label class="field">
          <span>Slutdatum</span>
          <input id="endDate" type="date" value="${values.endDate}" required />
        </label>
        <label class="field">
          <span>Sluttid</span>
          <input id="endTime" type="time" value="${values.endTime}" required />
        </label>
        ${
          isAdminUser
            ? `<label class="field">
                <span>Bokad av</span>
                <select id="owner" required>
                  ${USERS.map(
                    (familyUser) =>
                      `<option value="${familyUser.username}" ${familyUser.username === values.owner ? "selected" : ""}>${familyUser.name}</option>`,
                  ).join("")}
                </select>
              </label>`
            : `<input id="owner" type="hidden" value="${user.username}" />`
        }
        <label class="field">
          <span>Destination</span>
          <input id="destination" type="text" value="${escapeAttribute(values.destination)}" maxlength="70" placeholder="Västkusten, fjällen..." />
        </label>
        <label class="field wide">
          <span>Notering</span>
          <textarea id="notes" maxlength="240" placeholder="Nycklar, hämtning, service, packning...">${escapeHtml(values.notes)}</textarea>
        </label>
      </div>
      <p id="bookingMessage" class="message" aria-live="polite"></p>
      <div class="form-actions">
        <button class="primary-button" type="submit">${icons.calendar} ${submitText}</button>
        <button id="cancelEditButton" class="secondary-button ${editingBooking ? "" : "hidden"}" type="button">Avbryt</button>
      </div>
    </form>
  `;
}

function renderCalendar(bookings, user) {
  const days = getCalendarDays(visibleMonth);
  const today = toIsoDate(new Date());

  return `
    <div class="panel-heading">
      <div>
        <p class="section-kicker" style="color: var(--pine)">${icons.calendar} Översikt</p>
        <h2>Kalender</h2>
      </div>
      <div class="calendar-controls">
        <button id="prevMonthButton" class="icon-button" type="button" title="Föregående månad" aria-label="Föregående månad">
          ${icons.chevronLeft}
        </button>
        <strong class="calendar-title">${monthFormatter.format(visibleMonth)}</strong>
        <button id="nextMonthButton" class="icon-button" type="button" title="Nästa månad" aria-label="Nästa månad">
          ${icons.chevronRight}
        </button>
      </div>
    </div>
    <div class="weekday-row" aria-hidden="true">
      <span>Mån</span><span>Tis</span><span>Ons</span><span>Tor</span><span>Fre</span><span>Lör</span><span>Sön</span>
    </div>
    <div class="calendar-grid">
      ${days
        .map((date) => {
          const isoDate = toIsoDate(date);
          const inMonth = date.getMonth() === visibleMonth.getMonth();
          const dayBookings = bookingsForDay(bookings, date);
          return `
            <div class="day-cell ${inMonth ? "" : "outside"} ${isoDate === today ? "today" : ""}">
              <button class="day-button" type="button" data-date="${isoDate}" aria-label="Boka ${longDateFormatter.format(date)}">
                <span class="day-number">${date.getDate()}</span>
                ${dayBookings.length ? '<span class="day-dot"></span>' : ""}
              </button>
              <div class="day-bookings">
                ${dayBookings
                  .slice(0, 2)
                  .map((booking) => {
                    const label = escapeHtml(shortBookingLabel(booking));
                    const title = escapeAttribute(booking.title);
                    return canManageBooking(user, booking)
                      ? `<button class="calendar-booking" type="button" data-booking-id="${booking.id}" title="${title}">${label}</button>`
                      : `<span class="calendar-booking read-only" title="${title}">${label}</span>`;
                  })
                  .join("")}
                ${dayBookings.length > 2 ? `<span class="more-bookings">+${dayBookings.length - 2} fler</span>` : ""}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderBookingList(bookings, user) {
  const now = new Date();
  const upcoming = bookings
    .filter((booking) => parseBookingEnd(booking) >= now)
    .sort((a, b) => parseBookingStart(a) - parseBookingStart(b));

  return `
    <div class="panel-heading">
      <div>
        <p class="section-kicker" style="color: var(--pine)">${icons.clock} Kommande</p>
        <h2>Bokningar</h2>
      </div>
    </div>
    ${
      upcoming.length
        ? `<div class="booking-list">
            ${upcoming.map((booking) => renderBookingCard(booking, user)).join("")}
          </div>`
        : `<div class="empty-state">
            <h3>Inga kommande bokningar</h3>
            <p>Kalendern är fri.</p>
          </div>`
    }
  `;
}

function renderBookingCard(booking, user) {
  const owner = findUser(booking.owner);
  const canManage = canManageBooking(user, booking);
  return `
    <article class="booking-card">
      <div>
        <h3>${escapeHtml(booking.title)}</h3>
        <div class="booking-meta">
          <span>${icons.clock} ${formatBookingRange(booking)}</span>
          <span><span class="avatar" style="width:22px;height:22px;background:${owner.color};font-size:.65rem">${owner.initials}</span>${owner.name}</span>
          ${booking.destination ? `<span>${icons.map} ${escapeHtml(booking.destination)}</span>` : ""}
        </div>
        ${booking.notes ? `<p class="booking-notes">${escapeHtml(booking.notes)}</p>` : ""}
      </div>
      ${
        canManage
          ? `<div class="booking-actions">
              <button class="icon-button" type="button" data-edit-id="${booking.id}" title="Ändra bokning" aria-label="Ändra bokning">
                ${icons.edit}
              </button>
              <button class="icon-button delete-button" type="button" data-delete-id="${booking.id}" title="Ta bort bokning" aria-label="Ta bort bokning">
                ${icons.trash}
              </button>
            </div>`
          : ""
      }
    </article>
  `;
}

function bindDashboardEvents(session) {
  document.querySelector("#logoutButton").addEventListener("click", async () => {
    try {
      await apiRequest("logout", { method: "POST" });
    } catch {
      // Sessionen rensas i gränssnittet även om nätverket hickar.
    }
    bookingsCache = [];
    editingBookingId = null;
    renderLogin();
    showToast("Du är utloggad.");
  });

  document.querySelector("#newBookingButton").addEventListener("click", () => {
    editingBookingId = null;
    selectedDate = toIsoDate(new Date());
    renderDashboard(session);
    focusBookingForm();
  });

  document.querySelector("#jumpCalendarButton").addEventListener("click", () => {
    document.querySelector("#calendarSection").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelector("#bookingForm").addEventListener("submit", (event) => {
    void handleBookingSubmit(event, session);
  });

  const cancelButton = document.querySelector("#cancelEditButton");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      editingBookingId = null;
      renderDashboard(session);
      showToast("Ändringen avbröts.");
    });
  }

  document.querySelector("#prevMonthButton").addEventListener("click", () => {
    visibleMonth = addMonths(visibleMonth, -1);
    renderDashboard(session);
    document.querySelector("#calendarSection").scrollIntoView({ block: "start" });
  });

  document.querySelector("#nextMonthButton").addEventListener("click", () => {
    visibleMonth = addMonths(visibleMonth, 1);
    renderDashboard(session);
    document.querySelector("#calendarSection").scrollIntoView({ block: "start" });
  });

  document.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDate = button.dataset.date;
      editingBookingId = null;
      renderDashboard(session);
      focusBookingForm();
    });
  });

  document.querySelectorAll("[data-booking-id], [data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const bookingId = button.dataset.bookingId || button.dataset.editId;
      const booking = getBookings().find((item) => item.id === bookingId);
      if (!booking || !canManageBooking(findUser(session.username), booking)) {
        showToast("Du kan bara ändra dina egna bokningar.");
        return;
      }
      editingBookingId = bookingId;
      renderDashboard(session);
      focusBookingForm();
    });
  });

  document.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const booking = getBookings().find((item) => item.id === button.dataset.deleteId);
      if (!booking) return;
      if (!canManageBooking(findUser(session.username), booking)) {
        showToast("Du kan bara ta bort dina egna bokningar.");
        return;
      }
      const confirmed = window.confirm(`Ta bort bokningen "${booking.title}"?`);
      if (!confirmed) return;
      try {
        const response = await apiRequest("bookings", { method: "DELETE", id: booking.id });
        bookingsCache = normalizeBookings(response.bookings);
        if (editingBookingId === booking.id) editingBookingId = null;
        renderDashboard(session);
        showToast("Bokningen är borttagen.");
      } catch (error) {
        showToast(error.message || "Kunde inte ta bort bokningen.");
      }
    });
  });
}

async function handleLogin(event) {
  event.preventDefault();
  const message = document.querySelector("#loginMessage");
  const email = normalizeLogin(document.querySelector("#username").value);
  const password = document.querySelector("#password").value;

  try {
    const response = await apiRequest("login", {
      method: "POST",
      body: { email, password },
    });
    syncUsers(response.users);
    await refreshBookings();
    showToast(`Välkommen, ${response.user.name}.`);
    renderDashboard(response.user);
  } catch (error) {
    message.textContent = error.message || "Fel användare eller lösenord.";
  }
}

async function handleBookingSubmit(event, session) {
  event.preventDefault();
  const message = document.querySelector("#bookingMessage");
  const existingId = document.querySelector("#bookingId").value;
  const bookings = getBookings();
  const existingBooking = existingId ? bookings.find((booking) => booking.id === existingId) : null;
  const currentUser = findUser(session.username);

  if (existingId && (!existingBooking || !canManageBooking(currentUser, existingBooking))) {
    message.textContent = "Du kan bara ändra dina egna bokningar.";
    return;
  }

  const title = document.querySelector("#title").value.trim() || "Husbilen bokad";
  const payload = {
    id: existingId || crypto.randomUUID(),
    title,
    startDate: document.querySelector("#startDate").value,
    startTime: document.querySelector("#startTime").value,
    endDate: document.querySelector("#endDate").value,
    endTime: document.querySelector("#endTime").value,
    owner: isAdmin(session.username) ? document.querySelector("#owner").value : session.username,
    destination: document.querySelector("#destination").value.trim(),
    notes: document.querySelector("#notes").value.trim(),
    updatedAt: new Date().toISOString(),
  };

  const validationError = validateBooking(payload);
  if (validationError) {
    message.textContent = validationError;
    return;
  }

  const conflict = bookings.find((booking) => booking.id !== payload.id && bookingsOverlap(payload, booking));
  if (conflict) {
    const owner = findUser(conflict.owner);
    message.textContent = `Krockar med ${conflict.title} (${owner.name}, ${formatBookingRange(conflict)}).`;
    return;
  }

  try {
    const response = await apiRequest("bookings", {
      method: existingId ? "PUT" : "POST",
      id: existingId || undefined,
      body: payload,
    });
    bookingsCache = normalizeBookings(response.bookings);
    editingBookingId = null;
    selectedDate = payload.startDate;
    visibleMonth = startOfMonth(parseLocalDate(payload.startDate));
    renderDashboard(session);
    showToast(existingId ? "Bokningen är uppdaterad." : "Bokningen är sparad.");
  } catch (error) {
    message.textContent = error.message || "Bokningen kunde inte sparas.";
  }
}

function validateBooking(booking) {
  if (!booking.startDate || !booking.startTime || !booking.endDate || !booking.endTime) {
    return "Fyll i start och slut.";
  }

  if (parseBookingStart(booking) >= parseBookingEnd(booking)) {
    return "Sluttiden behöver vara efter starttiden.";
  }

  return "";
}

function getBookings() {
  return normalizeBookings(bookingsCache);
}

async function refreshBookings() {
  const response = await apiRequest("bookings");
  bookingsCache = normalizeBookings(response.bookings);
  return bookingsCache;
}

async function apiRequest(action, options = {}) {
  const body = new URLSearchParams();
  body.set("action", action);
  body.set("method", options.method || "GET");
  body.set("id", options.id || "");
  Object.entries(options.body || {}).forEach(([key, value]) => {
    body.set(key, value == null ? "" : String(value));
  });

  const response = await fetch(new URL(API_URL, window.location.href).toString(), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error("API:t svarade inte med JSON. Kör husbilssidan via PHP/Simply.");
  }

  if (!response.ok) {
    throw new Error(payload?.error || "Något gick fel.");
  }

  return payload;
}

function syncUsers(users) {
  if (Array.isArray(users) && users.length) {
    USERS = users;
  }
}

function normalizeBookings(bookings) {
  if (!Array.isArray(bookings)) return [];
  return [...bookings].sort((a, b) => parseBookingStart(a) - parseBookingStart(b));
}

function getDefaultBookingValues(user) {
  const startDate = selectedDate || toIsoDate(new Date());
  return {
    title: "",
    startDate,
    startTime: "09:00",
    endDate: startDate,
    endTime: "18:00",
    owner: user.username,
    destination: "",
    notes: "",
  };
}

function getStats(bookings) {
  const now = new Date();
  const upcoming = bookings.filter((booking) => parseBookingEnd(booking) >= now);
  const next = upcoming[0];
  const current = bookings.find((booking) => parseBookingStart(booking) <= now && parseBookingEnd(booking) >= now);
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const monthBookings = bookings.filter((booking) => parseBookingStart(booking) <= monthEnd && parseBookingEnd(booking) >= monthStart);
  const bookedDays = countBookedDays(monthBookings, monthStart, monthEnd);

  return {
    nextTitle: next ? next.title : "Ledig",
    nextSubtitle: next ? formatBookingRange(next) : "Ingen resa inlagd framåt",
    monthCount: bookedDays ? `${bookedDays} bokade dagar` : "0 bokade dagar",
    monthSubtitle: monthBookings.length ? `${monthBookings.length} perioder i kalendern` : "Hela månaden är öppen",
    currentTitle: current ? "Ute på tur" : "Ledig",
    currentSubtitle: current ? `${findUser(current.owner).name} har bokningen` : "Ingen aktiv bokning just nu",
  };
}

function countBookedDays(bookings, minDate, maxDate) {
  const days = new Set();
  bookings.forEach((booking) => {
    const start = clampDate(startOfDay(parseBookingStart(booking)), minDate, maxDate);
    const end = clampDate(startOfDay(parseBookingEnd(booking)), minDate, maxDate);
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      days.add(toIsoDate(cursor));
    }
  });
  return days.size;
}

function getCalendarDays(monthDate) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const endOffset = 6 - ((monthEnd.getDay() + 6) % 7);
  const first = addDays(monthStart, -startOffset);
  const last = addDays(monthEnd, endOffset);
  const days = [];

  for (let cursor = new Date(first); cursor <= last; cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }

  return days;
}

function bookingsForDay(bookings, date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  return bookings
    .filter((booking) => parseBookingStart(booking) <= dayEnd && parseBookingEnd(booking) >= dayStart)
    .sort((a, b) => parseBookingStart(a) - parseBookingStart(b));
}

function bookingsOverlap(first, second) {
  return parseBookingStart(first) < parseBookingEnd(second) && parseBookingEnd(first) > parseBookingStart(second);
}

function parseBookingStart(booking) {
  return parseLocalDateTime(booking.startDate, booking.startTime);
}

function parseBookingEnd(booking) {
  return parseLocalDateTime(booking.endDate, booking.endTime);
}

function parseLocalDateTime(date, time) {
  return new Date(`${date}T${time}:00`);
}

function parseLocalDate(date) {
  return new Date(`${date}T00:00:00`);
}

function formatBookingRange(booking) {
  const start = parseBookingStart(booking);
  const end = parseBookingEnd(booking);
  const sameDate = booking.startDate === booking.endDate;
  const startText = `${dateFormatter.format(start)} ${booking.startTime}`;
  const endText = sameDate ? booking.endTime : `${dateFormatter.format(end)} ${booking.endTime}`;
  return `${startText} - ${endText}`;
}

function shortBookingLabel(booking) {
  return `${booking.startTime} ${booking.title}`;
}

function findUser(username) {
  const normalizedUsername = normalizeUsername(username);
  return (
    USERS.find((user) => user.username === normalizedUsername) || {
      username: normalizedUsername,
      name: normalizedUsername || "Okänd",
      initials: "?",
      color: "#667166",
      admin: false,
    }
  );
}

function normalizeUsername(username) {
  return String(username).trim().toLowerCase();
}

function normalizeLogin(login) {
  return String(login).trim().toLowerCase();
}

function isAdmin(username) {
  return Boolean(findUser(username).admin) || normalizeUsername(username) === "martin";
}

function canManageBooking(user, booking) {
  return isAdmin(user.username) || booking.owner === user.username;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function clampDate(date, minDate, maxDate) {
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function focusBookingForm() {
  window.setTimeout(() => {
    document.querySelector("#bookingFormSection").scrollIntoView({ behavior: "smooth", block: "start" });
    const titleInput = document.querySelector("#title");
    if (titleInput) titleInput.focus({ preventScroll: true });
  }, 0);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 2600);
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
