import re

for filename in ['platform.css', 'style.css']:
    with open(filename, 'r') as f:
        css = f.read()

    css = css.replace('button, .primary-action, .secondary-action {', '.primary-action, .secondary-action {')
    css = css.replace('button::after, .primary-action::after, .secondary-action::after {', '.primary-action::after, .secondary-action::after {')
    css = css.replace('button:hover::after, .primary-action:hover::after, .secondary-action:hover::after {', '.primary-action:hover::after, .secondary-action:hover::after {')

    with open(filename, 'w') as f:
        f.write(css)

print("Buttons un-clipped.")
