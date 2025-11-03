# FaithCafe

# Quick start
- Using VS Code: Install the Live Server extension and "Open with Live Server" on `index.html` or the `templates/` pages.
- The site is also accessible under the link https://faithcafe.vercel.app/

# Project structure
- `index.html` — main landing / login page
- `templates/` — app pages (home, menu, cart, admin pages, status, etc.)
- `static/` — CSS and JavaScript (`static/js/script.js`, `static/js/status.js`, etc.)
- `data/` — JSON seed data: `users.json`, `menu.json`, `orders.json`, `cart.json`

# Default sample accounts (from `data/users.json`)
- Admin
  - username: `Admin`
  - password: `admin123`
  - role: `admin`
- Staff
  - username: `Staff`
  - password: `staff123`
  - role: `staff`
- Customers
  - username: `Faith` / password: `peyt1105`
  - username: `Christine` / password: `cresteen`
- Riders (cannot login — no password field)
  - `Juan Dela Cruz`, `Maria Santos`, `Pedro Reyes` (role: `rider`)
