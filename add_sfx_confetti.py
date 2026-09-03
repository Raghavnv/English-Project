import re

with open('platform.html', 'r') as f:
    html = f.read()

# Inject canvas-confetti CDN in head
confetti_script = '<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>'
if 'canvas-confetti' not in html:
    html = html.replace('</head>', f'  {confetti_script}\n</head>')

# Inject SFX script right before the closing body
sfx_js = """
  <!-- AUDIO & CONFETTI ENGINE -->
  <script>
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;

    function initAudio() {
      if (!audioCtx) {
        audioCtx = new AudioContext();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    }

    function playPopSound() {
      if(!audioCtx) initAudio();
      if(!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    }

    function playChimeSound() {
      if(!audioCtx) initAudio();
      if(!audioCtx) return;
      
      const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      chord.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + (i * 0.08));
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + (i * 0.08) + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (i * 0.08) + 1.0);
        
        osc.start(audioCtx.currentTime + (i * 0.08));
        osc.stop(audioCtx.currentTime + (i * 0.08) + 1.2);
      });
    }

    function fireConfetti() {
      if (typeof confetti !== 'undefined') {
        const duration = 2500;
        const end = Date.now() + duration;

        (function frame() {
          confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.8 },
            colors: ['#bc5d2d', '#fbbf24', '#ffffff']
          });
          confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.8 },
            colors: ['#bc5d2d', '#fbbf24', '#ffffff']
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        }());
      }
    }
    
    // Wire up clicks to pop sound globally for interactive elements
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, .module-card, .class-button, .rail-btn');
      if (target && target.id !== 'themeToggleBtn') {
        initAudio();
        playPopSound();
      }
    });
  </script>
"""

if 'playPopSound()' not in html:
    html = html.replace('</body>', sfx_js + '\n</body>')

with open('platform.html', 'w') as f:
    f.write(html)

print("SFX and Confetti added.")
