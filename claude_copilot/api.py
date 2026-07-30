"""
api.py - the only server-side surface the browser widget talks to.

Design choice: this whitelisted method does NOT call Claude itself. It is a
thin, auditable proxy that forwards to the orchestration middleware
(../../middleware/main.py) together with:
  - the message text
  - screen context (doctype, docname, route) sent by the widget
  - the CURRENT LOGGED-IN USER's identity/session

The middleware then uses THAT user's Frappe session/API key to call back
into ERPNext for any live-data lookups, so the assistant only ever sees
what the asking user is already allowed to see in Desk. No shared/service
account is used for data access. Every call is also written to the
"Claude Copilot Log" doctype (see claude_copilot/doctype/) for audit.
"""
import json
import frappe
from frappe import _


@frappe.whitelist()
def ask(message, doctype=None, docname=None, route=None):
    """Called by public/js/claude_copilot_v3.js on every chat turn."""
    import requests

    # Read fresh on every call rather than caching at import time — Frappe's
    # worker processes are long-lived, so a module-level global set once at
    # import would keep the value it had the moment the worker first loaded
    # this file (e.g. the localhost:8008 default, if that happened before
    # claude_copilot_middleware_url was added to site_config.json), and a
    # simple "Clear cache" doesn't reimport Python modules or restart workers.
    middleware_url = frappe.conf.get("claude_copilot_middleware_url", "http://localhost:8008/chat")

    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Please log in to use the assistant."))

    payload = {
        "message": message,
        "user": user,
        "screen_context": {
            "doctype": doctype,
            "docname": docname,
            "route": route,
        },
        # Short-lived token the middleware uses to call back into THIS
        # site's REST API as THIS user (never a shared service account).
        "frappe_site": frappe.local.site,
        "frappe_user_api_key": _get_or_create_user_api_key(user),
    }

    try:
        resp = requests.post(middleware_url, json=payload, timeout=30)
        resp.raise_for_status()
        result = resp.json()
    except Exception as e:
        frappe.log_error(title="Claude Copilot middleware call failed", message=str(e))
        frappe.throw(_("The assistant is temporarily unavailable. Please try again."))

    _log_interaction(user, doctype, docname, message, result.get("answer", ""))
    return result


def _get_or_create_user_api_key(user):
    """Reuses (or generates) the user's own API key/secret pair so the
    middleware authenticates to ERPNext's REST API as that specific user,
    inheriting their exact role-based permissions."""
    api_key = frappe.db.get_value("User", user, "api_key")
    if not api_key:
        from frappe.core.doctype.user.user import generate_keys
        generate_keys(user)
        api_key = frappe.db.get_value("User", user, "api_key")
    api_secret = frappe.utils.password.get_decrypted_password("User", user, "api_secret", raise_exception=False)
    return {"api_key": api_key, "api_secret": api_secret}


def _log_interaction(user, doctype, docname, message, answer):
    """Writes to a simple audit doctype. Create 'Claude Copilot Log' via
    the Frappe UI/migration with fields: user (Link User), doctype_context
    (Data), docname_context (Data), message (Small Text), answer (Text),
    creation (default timestamp)."""
    try:
        frappe.get_doc({
            "doctype": "Claude Copilot Log",
            "user": user,
            "doctype_context": doctype,
            "docname_context": docname,
            "message": message,
            "answer": answer[:5000],
        }).insert(ignore_permissions=True)
    except Exception:
        # Don't let logging failures break the chat response.
        frappe.log_error(title="Claude Copilot Log insert failed")
