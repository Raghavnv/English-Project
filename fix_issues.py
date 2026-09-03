import re

with open('platform.css', 'r') as f:
    css = f.read()

# 1. Remove tooltip CSS
css = re.sub(r'\.rail-btn::after\s*\{[^}]*\}\s*\.rail-btn:hover::after\s*\{[^}]*\}', '', css, flags=re.DOTALL)

# Also remove any single block of .rail-btn::after if it wasn't caught by the combined regex
css = re.sub(r'\.rail-btn::after\s*\{[^}]*\}', '', css)
css = re.sub(r'\.rail-btn:hover::after\s*\{[^}]*\}', '', css)

# 2. Fix the overflow: hidden on button
# The block looks like:
# button, .primary-action, .secondary-action {
#   position: relative;
#   overflow: hidden;
#   ...
css = css.replace('button, .primary-action, .secondary-action {', '.primary-action, .secondary-action {')

# Also remove button::after just to be safe
css = css.replace('button::after, .primary-action::after', '.primary-action::after')

with open('platform.css', 'w') as f:
    f.write(css)

with open('style.css', 'r') as f:
    style_css = f.read()
style_css = style_css.replace('button, .primary-action, .secondary-action {', '.primary-action, .secondary-action {')
style_css = style_css.replace('button::after, .primary-action::after', '.primary-action::after')
with open('style.css', 'w') as f:
    f.write(style_css)

print("Tooltip and button overflow fixed.")
