/* The hamburger apps menu and the intake/email/options view switcher. */
import { el } from "./utils.js";
import { VIEW_META } from "./config.js";
import { loadCaseIntoEmail } from "./email-writer.js";

const viewIntakeEl = el("view-intake");
const viewEmailEl = el("view-email");
const viewOptionsEl = el("view-options");
const menuToggle = el("menuToggle");
const appMenu = el("appMenu");

let emailAutoLoaded = false;

export function switchView(name) {
  viewIntakeEl.hidden = name !== "intake";
  viewEmailEl.hidden = name !== "email";
  viewOptionsEl.hidden = name !== "options";

  const meta = VIEW_META[name];
  el("viewEyebrow").textContent = meta.eyebrow;
  el("viewTitle").textContent = meta.title;
  el("viewSubtitle").textContent = meta.subtitle;

  appMenu.querySelectorAll("button[data-view]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });

  // First time the email view is opened, pre-fill it from the current case
  // (if any) so switching tabs after an extraction feels seamless.
  if (name === "email" && !emailAutoLoaded) {
    emailAutoLoaded = true;
    loadCaseIntoEmail();
  }
}

export function initMenu() {
  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = appMenu.hasAttribute("hidden");
    if (willOpen) appMenu.removeAttribute("hidden"); else appMenu.setAttribute("hidden", "");
    menuToggle.setAttribute("aria-expanded", String(willOpen));
  });

  appMenu.querySelectorAll("button[data-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchView(btn.dataset.view);
      appMenu.setAttribute("hidden", "");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (e) => {
    if (!appMenu.hasAttribute("hidden") && !appMenu.contains(e.target) && e.target !== menuToggle) {
      appMenu.setAttribute("hidden", "");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !appMenu.hasAttribute("hidden")) {
      appMenu.setAttribute("hidden", "");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });

  el("openOptionsBtn").addEventListener("click", () => switchView("options"));
}
