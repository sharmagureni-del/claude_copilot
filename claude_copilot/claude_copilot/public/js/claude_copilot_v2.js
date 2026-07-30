/**
 * claude_copilot_v2.js
 * Injected on every Desk page via hooks.py (app_include_js).
 * Renders a floating launcher + chat panel, captures the current screen
 * context (route / doctype / docname), and calls the whitelisted
 * claude_copilot.api.ask method.
 *
 * Renamed from claude_copilot.js -> claude_copilot_v2.js on 2026-07-30 to
 * bust a "Cache-Control: max-age=31536000, immutable" edge cache on the
 * old asset URL that survived a redeploy (Frappe Cloud serves /assets/
 * with a 1-year immutable cache header, which is fine for content-hashed
 * bundle files but bites raw app_include_js paths like this one that never
 * change name). If you rename this file again in the future, bump the
 * suffix (v3, v4, ...) and update hooks.py's app_include_js to match.
 */
(function () {
  "use strict";

  const STATE = {
    open: false,
    history: [], // {role, text}
  };

  function getScreenContext() {
    const route = frappe.get_route ? frappe.get_route() : [];
    let doctype = null, docname = null;

    // Form view: cur_frm is set by the Desk when a document is open.
    if (typeof cur_frm !== "undefined" && cur_frm && cur_frm.doctype) {
      doctype = cur_frm.doctype;
      docname = cur_frm.docname;
    } else if (route && route[0] === "List" && route[1]) {
      doctype = route[1];
    } else if (route && route[0] === "query-report" && route[1]) {
      doctype = "Report:" + route[1];
    }

    return {
      route: (route || []).join("/"),
      doctype: doctype,
      docname: docname,
    };
  }

  function quickActionsFor(doctype) {
    const map = {
      "Sales Order": ["How do I convert this Sales Order into a Sales Invoice?", "Why can't I edit this after submit?"],
      "Quotation": ["How do I convert this Quotation into a Sales Order?"],
      "Purchase Order": ["How do I create a Purchase Receipt from this?", "How do I amend this after submit?"],
      "Material Request": ["How do I turn this into a Purchase Order?"],
      "Stock Entry": ["What's the difference between Material Issue and Material Transfer?"],
      "Delivery Note": ["How do I create the Sales Invoice from this Delivery Note?"],
    };
    return map[doctype] || ["What should I do on this screen?"];
  }

  function buildWidget() {
    const launcher = document.createElement("div");
    launcher.id = "claude-copilot-launcher";
    launcher.innerHTML = "✨";
    launcher.title = "Ask Aarya for help with this screen";
    document.body.appendChild(launcher);

    const panel = document.createElement("div");
    panel.id = "claude-copilot-panel";
    panel.style.display = "none";
    panel.innerHTML = `
      <div class="cc-header">
        <span>Aarya — ERPNext Assistant</span>
        <button class="cc-close">&times;</button>
      </div>
      <div class="cc-quick-actions"></div>
      <div class="cc-messages"></div>
      <div class="cc-input-row">
        <input type="text" class="cc-input" placeholder="Ask about this screen..." />
        <button class="cc-send">Send</button>
      </div>
      <div class="cc-disclaimer">Guidance only — verify any transactional change in ERPNext before relying on it.</div>
    `;
    document.body.appendChild(panel);

    launcher.addEventListener("click", () => togglePanel(panel));
    panel.querySelector(".cc-close").addEventListener("click", () => togglePanel(panel));
    panel.querySelector(".cc-send").addEventListener("click", () => sendMessage(panel));
    panel.querySelector(".cc-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage(panel);
    });

    return panel;
  }

  function togglePanel(panel) {
    STATE.open = !STATE.open;
    panel.style.display = STATE.open ? "flex" : "none";
    if (STATE.open) renderQuickActions(panel);
  }

  function renderQuickActions(panel) {
    const ctx = getScreenContext();
    const container = panel.querySelector(".cc-quick-actions");
    container.innerHTML = "";
    quickActionsFor(ctx.doctype).forEach((q) => {
      const chip = document.createElement("button");
      chip.className = "cc-chip";
      chip.textContent = q;
      chip.addEventListener("click", () => {
        panel.querySelector(".cc-input").value = q;
        sendMessage(panel);
      });
      container.appendChild(chip);
    });
  }

  function appendMessage(panel, role, text) {
    const messages = panel.querySelector(".cc-messages");
    const bubble = document.createElement("div");
    bubble.className = "cc-bubble cc-" + role;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function sendMessage(panel) {
    const input = panel.querySelector(".cc-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    appendMessage(panel, "user", text);

    const ctx = getScreenContext();
    appendMessage(panel, "assistant", "Thinking...");
    const messages = panel.querySelector(".cc-messages");
    const thinkingBubble = messages.lastChild;

    frappe.call({
      method: "claude_copilot.api.ask",
      args: {
        message: text,
        doctype: ctx.doctype,
        docname: ctx.docname,
        route: ctx.route,
      },
      callback: function (r) {
        thinkingBubble.remove();
        if (r.message && r.message.answer) {
          appendMessage(panel, "assistant", r.message.answer);
        } else {
          appendMessage(panel, "assistant", "Sorry, I couldn't get an answer just now.");
        }
      },
      error: function () {
        thinkingBubble.remove();
        appendMessage(panel, "assistant", "The assistant is temporarily unavailable.");
      },
    });
  }

  frappe.after_ajax(function () {
    if (frappe.session.user === "Guest") return;
    buildWidget();
  });
})();
