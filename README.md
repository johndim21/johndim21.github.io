# Giannis Dimitriadis — RPG Portfolio

An interactive, RPG-themed portfolio website: skills as a character sheet, projects as a quest log, career as an adventurer's chronicle. Built with vanilla HTML/CSS/JS plus **GSAP** (ScrollTrigger) for scroll choreography and **Three.js** for the drifting ember-particle background.

## Run locally

Any static file server works. For example:

```
python -m http.server 8123
```

Then open http://localhost:8123.

## Deploy

The site is fully static (`index.html`, `css/`, `js/`) — drop it on GitHub Pages, Netlify, Vercel, or any static host. GSAP, Three.js, and fonts load from CDNs.

## Features

- **Title screen** — animated entrance, typewriter narrator dialogue, HP/MP/XP plate
- **Character sheet** — animated attribute bars with count-up numbers, perks, portrait card
- **Quest log** — projects as Main/Epic/Side quests with status pills, loot (tech stack), allies, and XP rewards; 3D tilt on hover (desktop)
- **Chronicle** — career timeline with a scroll-drawn spine
- **Trophy hall** — publication, certifications, and languages as achievements
- **Easter egg** — Konami code (↑↑↓↓←→←→BA) or tap the LVL number 5× on touch devices
- **Mobile-friendly** — responsive layout, burger menu, reduced particle count on touch devices
- **Accessible defaults** — respects `prefers-reduced-motion`, semantic sections, aria labels
