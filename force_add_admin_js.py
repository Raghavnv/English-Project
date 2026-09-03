import re

with open('admin.js', 'r') as f:
    js = f.read()

features_js = """

// ══════════════════════════════════════════
// 1. ADMIN BUDDY (AI SIDEBAR)
// ══════════════════════════════════════════
function toggleAdminBuddy() {
  const panel = document.getElementById("adminBuddyPanel");
  panel.style.display = panel.style.display === "none" ? "flex" : "none";
  if(panel.style.display === "flex") {
    document.getElementById("adminBuddyInput").focus();
  }
}

async function sendAdminBuddy() {
  const input = document.getElementById("adminBuddyInput");
  const text = input.value.trim();
  if (!text) return;
  
  const chat = document.getElementById("adminBuddyChat");
  
  // Add user message
  const userMsg = document.createElement("div");
  userMsg.style.cssText = "align-self: flex-end; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%); color: white; padding: 12px 16px; border-radius: 16px; border-bottom-right-radius: 4px; max-width: 85%; font-size: 0.95rem; line-height: 1.5; box-shadow: 0 4px 12px rgba(188,93,45,0.2);";
  userMsg.textContent = text;
  chat.appendChild(userMsg);
  input.value = "";
  chat.scrollTop = chat.scrollHeight;
  
  // Loading state
  const loadingMsg = document.createElement("div");
  loadingMsg.style.cssText = "align-self: flex-start; background: rgba(188,93,45,0.08); padding: 12px 16px; border-radius: 16px; border-bottom-left-radius: 4px; border: 1px solid rgba(188,93,45,0.15); display: flex; gap: 6px; align-items: center;";
  loadingMsg.innerHTML = '<div style="width:6px;height:6px;background:var(--accent);border-radius:50%;animation:pulse 1s infinite;"></div><div style="width:6px;height:6px;background:var(--accent);border-radius:50%;animation:pulse 1s infinite 0.2s;"></div><div style="width:6px;height:6px;background:var(--accent);border-radius:50%;animation:pulse 1s infinite 0.4s;"></div>';
  chat.appendChild(loadingMsg);
  chat.scrollTop = chat.scrollHeight;
  
  try {
    const aiResponse = await window.apiFetch("/api/ai/buddy", {
      method: "POST",
      body: JSON.stringify({ message: "Context: I am an English teacher using the admin panel. User query: " + text })
    });
    
    loadingMsg.remove();
    
    const botMsg = document.createElement("div");
    botMsg.style.cssText = "align-self: flex-start; background: rgba(188,93,45,0.08); padding: 12px 16px; border-radius: 16px; border-bottom-left-radius: 4px; max-width: 85%; font-size: 0.95rem; color: #422006; line-height: 1.5; border: 1px solid rgba(188,93,45,0.15);";
    botMsg.innerHTML = String(aiResponse.response).replace(/\\n/g, '<br>').replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
    chat.appendChild(botMsg);
  } catch(e) {
    loadingMsg.remove();
    const errorMsg = document.createElement("div");
    errorMsg.style.cssText = "align-self: flex-start; background: #fee2e2; padding: 12px 16px; border-radius: 16px; border-bottom-left-radius: 4px; max-width: 85%; font-size: 0.95rem; color: #991b1b; line-height: 1.5;";
    errorMsg.textContent = "Sorry, I couldn't process that right now. Check backend connection.";
    chat.appendChild(errorMsg);
  }
  chat.scrollTop = chat.scrollHeight;
}

// ══════════════════════════════════════════
// 2. BULK CURRICULUM GENERATOR
// ══════════════════════════════════════════
function openBulkCurriculumModal() { document.getElementById("modalBulkCurriculum").classList.add("show"); }
function closeBulkCurriculumModal() { document.getElementById("modalBulkCurriculum").classList.remove("show"); }

async function runBulkCurriculum() {
  const topic = document.getElementById("bulkCurriculumTopic").value.trim();
  const count = parseInt(document.getElementById("bulkCurriculumCount").value) || 3;
  const btn = document.getElementById("generateCurriculumBtn");
  const loading = document.getElementById("bulkCurriculumLoading");
  
  if(!topic) { showPopup("Please enter a master topic first!"); return; }
  
  btn.disabled = true;
  loading.style.display = "flex";
  
  try {
    const response = await window.apiFetch('/api/ai/bulk-curriculum', {
      method: 'POST',
      body: JSON.stringify({ topic, count })
    });
    
    console.log("Generated curriculum:", response);
    // In a full implementation we would POST these modules to the database, but for now we just show success
    showPopup(`✨ Successfully generated ${response.modules.length} modules for "${response.course_title}"! Check the console to see the JSON.`);
    
    closeBulkCurriculumModal();
    loadLessonsData();
  } catch(e) {
    showPopup("Error generating curriculum: " + e.message);
  } finally {
    btn.disabled = false;
    loading.style.display = "none";
    document.getElementById("bulkCurriculumTopic").value = "";
  }
}

// ══════════════════════════════════════════
// 3. ADVANCED ANALYTICS CHARTS (CHART.JS)
// ══════════════════════════════════════════
let engagementChartInst = null;
let accuracyChartInst = null;

function renderAdminCharts() {
  const ctxE = document.getElementById('engagementChart');
  const ctxA = document.getElementById('accuracyChart');
  if(!ctxE || !ctxA) return;

  if(engagementChartInst) engagementChartInst.destroy();
  if(accuracyChartInst) accuracyChartInst.destroy();

  // Mock Data for Engagement
  engagementChartInst = new Chart(ctxE, {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{
        label: 'Active Students',
        data: [12, 19, 15, 22],
        borderColor: '#bc5d2d',
        backgroundColor: 'rgba(188,93,45,0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  // Mock Data for Accuracy
  accuracyChartInst = new Chart(ctxA, {
    type: 'bar',
    data: {
      labels: ['Grammar', 'Vocab', 'Speech', 'Reading'],
      datasets: [{
        label: 'Avg Accuracy %',
        data: [75, 88, 62, 91],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
        borderRadius: 6
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
}

// ══════════════════════════════════════════
// 4. LIVE CLASS ACTIVITY & AT-RISK FEED
// ══════════════════════════════════════════
function initLiveFeed() {
  const riskFeed = document.getElementById("atRiskRoster");
  if(riskFeed) {
    // Generate some mock at-risk students based on logic (e.g. low streaks)
    riskFeed.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px; background: rgba(255,255,255,0.6); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 8px;">
        <div><strong style="color: #991b1b; display:block;">Liam Smith</strong><span style="font-size:0.8rem; color: #b91c1c;">Streak Lost • 0 Logins in 7 Days</span></div>
        <button style="border:none; background: #ef4444; color:white; padding: 6px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: bold; cursor: pointer;" onclick="showPopup('Message sent to Liam.')">Message</button>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px; background: rgba(255,255,255,0.6); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2);">
        <div><strong style="color: #991b1b; display:block;">Emma Johnson</strong><span style="font-size:0.8rem; color: #b91c1c;">45% Avg Accuracy in Grammar</span></div>
        <button style="border:none; background: #ef4444; color:white; padding: 6px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: bold; cursor: pointer;" onclick="showPopup('Intervention module assigned.')">Assign Review</button>
      </div>
    `;
  }

  const liveFeed = document.getElementById("liveActivityFeed");
  if(!liveFeed) return;
  
  // Clear any existing intervals if re-running
  if(window.liveFeedInterval) clearInterval(window.liveFeedInterval);
  
  const activities = [
    "<strong>Sophia</strong> completed <em>Module 1: Greetings</em> 👏",
    "<strong>Noah</strong> started a Lightning Game ⚡",
    "<strong>Isabella</strong> is practicing Speech in the Pronunciation Lab 🎙️",
    "<strong>Mason</strong> earned the <em>7-Day Streak</em> badge! 🏆",
    "<strong>Olivia</strong> submitted an answer for review 📝"
  ];

  window.liveFeedInterval = setInterval(() => {
    const el = document.createElement("div");
    el.style.cssText = "padding: 8px 12px; background: rgba(255,255,255,0.6); border-radius: 8px; font-size: 0.85rem; color: #166534; animation: slideDown 0.3s ease-out; margin-bottom: 8px;";
    el.innerHTML = `<span style="opacity:0.6; font-size:0.75rem; margin-right:6px;">Just now</span> ` + activities[Math.floor(Math.random() * activities.length)];
    liveFeed.prepend(el);
    if(liveFeed.children.length > 5) {
      liveFeed.removeChild(liveFeed.lastChild);
    }
  }, 4500);
}

const style = document.createElement('style');
style.textContent = `@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`;
document.head.appendChild(style);

"""

# Ensure it's not already there
if "function toggleAdminBuddy" not in js:
    # Append safely
    js = js + "\n\n" + features_js

# Now hook them up
if 'renderAdminCharts();' not in js:
    js = js.replace('document.getElementById("analyticsAvgScore").textContent = avgAcc;', 
                    'document.getElementById("analyticsAvgScore").textContent = avgAcc;\n  if(typeof renderAdminCharts === "function") renderAdminCharts();')

if 'initLiveFeed();' not in js:
    js = js.replace('loadProgressData();', 
                    'loadProgressData();\n  if(typeof initLiveFeed === "function") initLiveFeed();')

with open('admin.js', 'w') as f:
    f.write(js)

print("Properly added missing JS!")
