import re

with open('admin.html', 'r') as f:
    html = f.read()

btn_html = """
        <div style="margin: 18px 0 24px; padding-bottom: 24px; border-bottom: 1px solid rgba(80,58,40,0.1);">
          <button class="primary-action" onclick="openBulkCurriculumModal()" style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); border-color: rgba(255,255,255,0.2); width: 100%;">🪄 Generate Full Curriculum (Bulk Course Builder)</button>
        </div>
"""

# Find the subtitle paragraph
target_str = '<p class="admin-card-subtitle">Build a lesson by hand or let AI generate the questions or flashcards for you — everything for a class and lesson lives here.</p>'

if btn_html.strip() not in html:
    html = html.replace(target_str, target_str + '\n' + btn_html)

with open('admin.html', 'w') as f:
    f.write(html)

print("Added Bulk Curriculum button to Lesson Studio.")
