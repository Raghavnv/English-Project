import re

with open('admin.js', 'r') as f:
    js = f.read()

old_code = """
    console.log("Generated curriculum:", response);
    showPopup(`✨ Successfully generated ${response.modules.length} modules for "${response.course_title}"!`);
    
    closeBulkCurriculumModal();
    // Simulate refresh by reloading data
    loadLessonsData();
"""

new_code = """
    console.log("Generated curriculum:", response);
    
    // Save each module as a real lesson in the database
    let className = "Course: " + response.course_title;
    for(let i=0; i<response.modules.length; i++) {
      let mod = response.modules[i];
      let qs = mod.questions || [];
      let fcs = mod.flashcards || [];
      await window.Lessons.create(className, mod.module_title, mod.description, qs, fcs);
    }
    
    showPopup(`✨ Successfully generated and saved ${response.modules.length} modules for "${response.course_title}"!`);
    
    closeBulkCurriculumModal();
    await renderSavedLessons(); // Actually refresh the UI with real data
"""

js = js.replace(old_code.strip(), new_code.strip())

with open('admin.js', 'w') as f:
    f.write(js)

print("Updated JS to save lessons to DB")
