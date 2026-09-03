import re

with open('admin.html', 'r') as f:
    html = f.read()

# 1. Add Chart.js to <head>
if 'chart.js' not in html:
    html = html.replace('</head>', '  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n</head>')

# 2. Add Charts to view-analytics
analytics_charts = """
        <div style="margin-top:24px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="background: rgba(255,255,255,0.8); border: 1px solid rgba(80,58,40,0.1); padding: 20px; border-radius: 18px;">
            <p style="font-weight: 800; font-size: 0.85rem; text-transform: uppercase; color: var(--accent-deep); margin: 0 0 10px; letter-spacing: 0.05em;">Engagement (30 Days)</p>
            <canvas id="engagementChart" style="width: 100%; height: 200px;"></canvas>
          </div>
          <div style="background: rgba(255,255,255,0.8); border: 1px solid rgba(80,58,40,0.1); padding: 20px; border-radius: 18px;">
            <p style="font-weight: 800; font-size: 0.85rem; text-transform: uppercase; color: var(--accent-deep); margin: 0 0 10px; letter-spacing: 0.05em;">Accuracy by Concept</p>
            <canvas id="accuracyChart" style="width: 100%; height: 200px;"></canvas>
          </div>
        </div>
"""
if 'engagementChart' not in html:
    html = html.replace('<div style="margin-top: 20px; background: rgba(255,255,255,0.8);', analytics_charts + '\n        <div style="margin-top: 20px; background: rgba(255,255,255,0.8);')

# 3. Add At-Risk & Live Feed to view-progress
at_risk_live = """
        <!-- AT-RISK & LIVE FEED -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; margin-bottom: 24px;">
          <div style="background: rgba(239, 68, 68, 0.04); border: 1px solid rgba(239, 68, 68, 0.2); padding: 20px; border-radius: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <p style="font-weight: 800; font-size: 0.85rem; text-transform: uppercase; color: #b91c1c; margin: 0; letter-spacing: 0.05em;">⚠️ Attention Needed</p>
            </div>
            <div id="atRiskRoster" style="display:flex; flex-direction:column; gap:10px;">
              <!-- Populated by JS -->
            </div>
          </div>
          <div style="background: rgba(34, 197, 94, 0.04); border: 1px solid rgba(34, 197, 94, 0.2); padding: 20px; border-radius: 18px; position: relative; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; animation: pulse 1.5s infinite;"></div>
              <p style="font-weight: 800; font-size: 0.85rem; text-transform: uppercase; color: #15803d; margin: 0; letter-spacing: 0.05em;">Live Class Activity</p>
            </div>
            <div id="liveActivityFeed" style="display:flex; flex-direction:column; gap:10px; max-height: 140px; overflow-y: auto;">
              <!-- Populated by JS -->
            </div>
            <style>@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }</style>
          </div>
        </div>
"""
if 'atRiskRoster' not in html:
    html = html.replace('<div class="progress-controls" style="margin-top:18px;">', at_risk_live + '\n        <div class="progress-controls" style="margin-top:18px;">')

# 4. Add Curriculum Generator Button to view-lessons
curriculum_btn = """<button class="primary-action" onclick="openBulkCurriculumModal()" style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); border-color: rgba(255,255,255,0.2);">🪄 Generate Full Curriculum</button>"""
if 'openBulkCurriculumModal' not in html:
    html = html.replace('<button class="primary-action" onclick="runAIGenerate()">✨ Generate</button>', '<button class="primary-action" onclick="runAIGenerate()">✨ Generate Question</button>\n            ' + curriculum_btn)

# 5. Add Bulk Curriculum Modal
bulk_modal = """
<!-- BULK CURRICULUM MODAL -->
<div class="modal-backdrop" id="modalBulkCurriculum">
  <div class="modal-window" style="max-width: 500px;">
    <button class="modal-close" onclick="closeBulkCurriculumModal()">×</button>
    <div class="modal-header">
      <h3 style="font-size: 1.4rem; font-family: var(--font-family); font-weight: 800; color: var(--text);">🪄 AI Curriculum Builder</h3>
    </div>
    <div class="modal-body" style="padding-top: 10px;">
      <p style="color: var(--muted); font-size: 0.95rem; margin-bottom: 20px;">Provide a master topic and Buddy will instantly generate a multi-module course curriculum.</p>
      
      <label class="form-label" style="margin-top: 0;">Master Topic</label>
      <input type="text" id="bulkCurriculumTopic" class="admin-input" placeholder="e.g. Travel and Airport English" style="width: 100%; border-radius: 12px; padding: 12px 14px; border: 1px solid rgba(80,58,40,0.12); margin-top: 6px; font-family: inherit;">
      
      <label class="form-label" style="margin-top: 16px;">Number of Modules</label>
      <select id="bulkCurriculumCount" class="admin-select" style="margin-top: 6px;">
        <option value="3">3 Modules (Short Course)</option>
        <option value="5">5 Modules (Standard Course)</option>
      </select>
      
      <div id="bulkCurriculumLoading" style="display:none; flex-direction:column; gap:12px; padding: 24px; margin-top: 16px;">
        <div class="skeleton-pulse" style="height: 24px; width: 60%; border-radius: 6px;"></div>
        <div class="skeleton-pulse" style="height: 16px; width: 100%; border-radius: 4px;"></div>
        <div class="skeleton-pulse" style="height: 16px; width: 90%; border-radius: 4px;"></div>
        <p style="color: var(--accent); margin: 12px 0 0 0; font-weight: 600;">Generating comprehensive curriculum...</p>
      </div>
      
    </div>
    <div class="modal-footer" style="margin-top: 24px;">
      <button class="secondary-action" onclick="closeBulkCurriculumModal()">Cancel</button>
      <button class="primary-action" id="generateCurriculumBtn" onclick="runBulkCurriculum()">Generate Course</button>
    </div>
  </div>
</div>
"""
if 'modalBulkCurriculum' not in html:
    html = html.replace('<!-- BULK UPLOAD MODAL -->', bulk_modal + '\n<!-- BULK UPLOAD MODAL -->')

# 6. Add Admin Buddy Sidebar (Floating)
admin_buddy = """
<!-- ADMIN BUDDY FLOATING WIDGET -->
<div id="adminBuddyWidget" style="position: fixed; bottom: 30px; right: 30px; z-index: 10001; display: flex; flex-direction: column; align-items: flex-end; gap: 16px;">
  
  <div id="adminBuddyPanel" style="display: none; width: 340px; height: 480px; background: rgba(255,252,248,0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-radius: 24px; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.8); flex-direction: column; overflow: hidden; transform-origin: bottom right; animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
    <div style="background: linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%); padding: 18px 22px; color: white; display: flex; align-items: center; justify-content: space-between;">
      <div>
        <h3 style="margin: 0; font-family: var(--font-family); font-weight: 800; font-size: 1.1rem;">Admin Buddy</h3>
        <p style="margin: 2px 0 0; font-size: 0.8rem; opacity: 0.9;">Your AI Teaching Assistant</p>
      </div>
      <button onclick="toggleAdminBuddy()" style="background: rgba(255,255,255,0.2); border: none; width: 28px; height: 28px; border-radius: 50%; color: white; cursor: pointer; font-weight: bold;">✕</button>
    </div>
    
    <div id="adminBuddyChat" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px;">
      <div style="align-self: flex-start; background: rgba(188,93,45,0.08); padding: 12px 16px; border-radius: 16px; border-bottom-left-radius: 4px; max-width: 85%; font-size: 0.95rem; color: #422006; line-height: 1.5; border: 1px solid rgba(188,93,45,0.15);">
        Hi! I'm Buddy. Need help drafting an announcement, analyzing a student's progress, or brainstorming lesson ideas? Just ask!
      </div>
    </div>
    
    <div style="padding: 16px; border-top: 1px solid rgba(80,58,40,0.1); background: white;">
      <div style="display: flex; gap: 8px;">
        <input type="text" id="adminBuddyInput" placeholder="Ask Buddy anything..." style="flex: 1; border-radius: 999px; border: 1px solid rgba(80,58,40,0.2); padding: 0 16px; font-family: var(--font-family); outline: none; transition: border-color 0.2s;" onkeypress="if(event.key==='Enter') sendAdminBuddy()">
        <button onclick="sendAdminBuddy()" style="width: 40px; height: 40px; border-radius: 50%; border: none; background: var(--accent-deep); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(188,93,45,0.3); transition: transform 0.2s;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12L2.01 3L2 10l15 2-15 2z" fill="currentColor"/></svg>
        </button>
      </div>
    </div>
  </div>
  
  <button onclick="toggleAdminBuddy()" style="width: 64px; height: 64px; border-radius: 50%; border: none; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%); color: white; cursor: pointer; box-shadow: 0 12px 24px rgba(188,93,45,0.4); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
    🤖
  </button>
  
  <style>
    @keyframes popIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  </style>
</div>
"""
if 'adminBuddyWidget' not in html:
    html = html.replace('</body>', admin_buddy + '\n</body>')

with open('admin.html', 'w') as f:
    f.write(html)

print("Admin HTML features added!")
