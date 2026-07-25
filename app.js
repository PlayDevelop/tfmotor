const camperLinks = [
  document.querySelector("#camperLinkFooter"),
].filter(Boolean);

const isLocalPreview = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
const camperUrl = "/husbil/";

camperLinks.forEach((link) => {
  link.href = camperUrl;
});

const form = document.querySelector("#contactForm");
const status = document.querySelector("#formStatus");

if (form && status) {
  form.addEventListener("submit", (event) => {
    if (!isLocalPreview) return;

    event.preventDefault();
    const data = new FormData(form);
    const subject = encodeURIComponent(`[TF Motor kontaktform] Nytt meddelande från ${data.get("name") || "tfmotor.se"}`);
    const body = encodeURIComponent(
      [
        "*** TF MOTOR KONTAKTFORMULÄR ***",
        "Detta meddelande skickades från kontaktformuläret på tfmotor.se.",
        "Svara direkt på mailet för att svara avsändaren.",
        "",
        "--- Avsändare ---",
        `Namn: ${data.get("name") || ""}`,
        `E-post: ${data.get("email") || ""}`,
        `Telefon: ${data.get("phone") || ""}`,
        "",
        "--- Meddelande ---",
        String(data.get("message") || ""),
      ].join("\n"),
    );

    status.textContent = "Lokalt förhandsläge: öppnar mailprogrammet i stället för PHP.";
    window.location.href = `mailto:martin@hallagarde.se,gunnel@tfmotor.se?subject=${subject}&body=${body}`;
  });
}
