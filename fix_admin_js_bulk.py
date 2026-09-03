import re

with open('admin.js', 'r') as f:
    js = f.read()

# Replace the mock in runBulkCurriculum
old_code = """
  try {
    // We mock a delay, then create mock modules since there's no actual bulk endpoint in the real python backend yet
    await new Promise(r => setTimeout(r, 2500)); 
    
    showPopup(`✨ Successfully generated ${count} modules for "${topic}"! Refreshing Lesson Studio...`);
    closeBulkCurriculumModal();
    // Simulate refresh by reloading data (in reality we would push to classes[0])
    loadLessonsData(); 
  } catch(e) {
"""

new_code = """
  try {
    const response = await window.apiFetch('/api/ai/bulk-curriculum', {
      method: 'POST',
      body: JSON.stringify({ topic, count })
    });
    
    console.log("Generated curriculum:", response);
    // In a full implementation we would POST these modules to the database, but for now we just show success
    showPopup(`✨ Successfully generated ${response.modules.length} modules for "${response.course_title}"!`);
    
    closeBulkCurriculumModal();
    loadLessonsData();
  } catch(e) {
"""

# Because of template literals, replace string exactly avoiding escape issues
js = js.replace(old_code.strip(), new_code.strip())

with open('admin.js', 'w') as f:
    f.write(js)

print("Updated runBulkCurriculum in admin.js to hit the actual endpoint.")
