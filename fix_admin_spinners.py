import re

with open('admin.html', 'r') as f:
    html = f.read()

skeleton_html = """
          <div id="{id}" style="display:none; flex-direction:column; gap:12px; padding: 24px;">
            <div class="skeleton-pulse" style="height: 24px; width: 60%; border-radius: 6px;"></div>
            <div class="skeleton-pulse" style="height: 16px; width: 100%; border-radius: 4px;"></div>
            <div class="skeleton-pulse" style="height: 16px; width: 90%; border-radius: 4px;"></div>
            <div class="skeleton-pulse" style="height: 16px; width: 95%; border-radius: 4px;"></div>
            <p style="color: var(--accent); margin: 12px 0 0 0; font-weight: 600;">{text}</p>
          </div>
"""

# 1. reportLoadingState
html = re.sub(
    r'<div id="reportLoadingState".*?</p>\s*</div>',
    skeleton_html.format(id="reportLoadingState", text="Buddy is analyzing progress and writing the report...").strip(),
    html,
    flags=re.DOTALL
)

# 2. remedialGroupsLoading
html = re.sub(
    r'<div id="remedialGroupsLoading".*?</p>\s*</div>',
    skeleton_html.format(id="remedialGroupsLoading", text="Analyzing class performance data...").strip(),
    html,
    flags=re.DOTALL
)

# We also need to fix the JS side because the skeleton uses display:flex, not display:block.
# We'll do this in a minute.
with open('admin.html', 'w') as f:
    f.write(html)

# Now fix JS
with open('admin.js', 'r') as f:
    js = f.read()

js = js.replace('loading.style.display = "block"', 'loading.style.display = "flex"')

with open('admin.js', 'w') as f:
    f.write(js)

print("Spinners replaced with skeletons in Admin")
