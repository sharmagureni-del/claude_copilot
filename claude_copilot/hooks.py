from . import __version__ as app_version

app_name = "claude_copilot"
app_title = "Claude Copilot"
app_publisher = "Your Company"
app_description = "In-app Claude assistant that guides users through the correct ERPNext process on every screen."
app_email = "you@example.com"
app_license = "MIT"

# Injects the widget's JS/CSS into every standard Desk page (list view, form
# view, report view, workspace, POS, kanban, etc). This is the mechanism
# that makes the assistant show up "everywhere" without editing each page.
app_include_js = "/assets/claude_copilot/js/claude_copilot.js"
app_include_css = "/assets/claude_copilot/css/claude_copilot.css"

# Optional: also inject on the customer/supplier-facing portal (web) pages.
# web_include_js = "/assets/claude_copilot/js/claude_copilot.js"
# web_include_css = "/assets/claude_copilot/css/claude_copilot.css"

# -----------------------------------------------------------------------
# Whitelisted server-side endpoint the widget calls. This is a thin proxy:
# it does NOT talk to Claude directly from the browser (never expose an
# Anthropic API key client-side). Instead it forwards to the orchestration
# middleware (see ../../middleware/main.py), passing the current Frappe
# user's session so the middleware can call back into ERPNext with THAT
# user's permissions (never a shared service account).
# -----------------------------------------------------------------------
# See claude_copilot/api.py for the whitelisted method definition:
#   claude_copilot.api.ask
