# Scholar

A mobile-first, Kindle-style e-reader PWA for free and open-access scholarly articles.

## About

Scholar is an installable web application that makes discovering and reading open-access academic research easy on mobile devices. Search across millions of scholarly articles from OpenAlex, bookmark your favorites, customize your reading experience, and access articles anywhere.

## Features

- **Search**: Full-text search, author search, topic filtering, year range filters, and open-access toggle
- **Reader**: Clean, distraction-free reading interface with adjustable text size, font family, line spacing, and three themes (Light, Sepia, Dark)
- **Favorites**: Bookmark articles for later reading with persistent storage
- **Recently Read**: Auto-tracked reading history (capped at 20 articles)
- **Browse by Topic**: Quick-access chips for popular research topics
- **Offline Support**: Service worker enables offline access to previously read articles
- **Progressive Web App**: Install on any device; works like a native app

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Routing**: React Router v6
- **State**: Zustand (with localStorage persistence)
- **PWA**: Vite PWA Plugin (service worker, manifest, icons)
- **Styling**: Plain CSS (mobile-first)
- **Data Source**: OpenAlex API (no API key required)

## Getting Started

### Prerequisites

- Node.js v22+
- npm v10+

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens on `http://localhost:5173` by default.

### Production Build

```bash
npm run build
npm run preview
```

## Data Source

All articles are sourced from [OpenAlex](https://openalex.org), a free and comprehensive catalog of academic knowledge. The API is CORS-enabled and requires no authentication.

### API Features Used

- **Work Search**: `GET /works?search=<q>&per_page=25&page=<n>`
- **Filters**: Open access (`is_oa:true`), publication year range, author ID, concept ID
- **Metadata**: Title, authors, year, journal, DOI, citation count, abstract (inverted index)
- **Full Text**: PDF and landing page URLs for open-access works

## Architecture

### Stores (Zustand + localStorage)

- **`useFavoritesStore`**: Persisted bookmarks (Array<Article>)
- **`useReaderSettingsStore`**: User reading preferences (fontSize, fontFamily, lineSpacing, theme)
- **`useRecentsStore`**: Recently read articles, auto-deduped and capped at 20

### Pages

- **Home** (`/`): Recently read articles + topic chips
- **Search** (`/search`): Multi-field search form + paginated results
- **Reader** (`/reader/:articleId`): Clean reading pane + metadata + reading controls
- **Favorites** (`/favorites`): Saved articles list
- **Settings** (`/settings`): Default preferences + data management

### Components

- **Navigation**: Fixed bottom tab bar (Home, Search, Favorites, Settings)
- **ArticleCard**: Search result / favorite list item with bookmark toggle
- **ReaderControls**: Bottom sheet with font size, family, line spacing, and theme controls

## Feature Checklist

### 1. SEARCH ✓

- [x] Multi-field search (query, author, topic, year range)
- [x] Open-access toggle filter
- [x] Article cards with title, authors, year, journal, OA badge
- [x] Bookmark toggle on every card
- [x] Distinct UI states: empty query, loading, zero results, network error
- [x] Pagination with "Load more" button

### 2. READER ✓

- [x] Clean single-column reading pane with generous margins
- [x] Serif font by default; configurable family (serif/sans)
- [x] Adjustable line spacing (1, 1.5, 2)
- [x] Font size control (5 steps)
- [x] Three themes: Light, Sepia, Dark (apply live, persist)
- [x] Metadata block: authors, year, journal, DOI link, citation count
- [x] Reconstructed abstract from inverted index
- [x] "Read full text" button (hidden when no URL)
- [x] Recently-read tracking on open
- [x] Bookmark toggle in reader

### 3. FAVORITES ✓

- [x] Bookmark toggle on every card and in reader
- [x] Favorites list page
- [x] Persistent storage (localStorage via Zustand)
- [x] Immediate state updates across app
- [x] Friendly empty state

### 4. HOME ✓

- [x] "Continue reading" section (recently-read, max 20)
- [x] "Browse by topic" chips (~8 hardcoded topics)
- [x] Topic chips navigate to pre-filled search

### 5. MOBILE SHELL / PWA ✓

- [x] Fixed bottom tab bar (Home, Search, Favorites, Settings)
- [x] Mobile-first CSS, fully usable at 375px width
- [x] No horizontal scroll
- [x] Touch targets >= 44px (buttons, links)
- [x] Valid PWA manifest (`manifest.webmanifest`)
- [x] Service worker + offline caching (via vite-plugin-pwa)
- [x] Icon files (192px, 512px PNG)
- [x] `display: standalone` for app-like experience

### 6. SETTINGS ✓

- [x] Set default reading theme (Light, Sepia, Dark)
- [x] Set default font (Serif, Sans)
- [x] Set default line spacing (1, 1.5, 2)
- [x] Set default font size (5 steps)
- [x] "Clear data" button with confirmation
- [x] Clears both favorites and recents on confirm

## Design Notes

### Aesthetic

- **Default theme**: Warm off-white (`#f5f1e8`) for a Kindle-like reading experience
- **Typography**: Georgia serif stack for reading; system sans for UI
- **Spacing**: Generous margins and line-height for comfortable reading
- **Measure**: Reading column max-width ~45rem for optimal line length
- **Colors**: Accent blue for interactive elements; light grays for secondary text

### Mobile-First Approach

All CSS is written mobile-first (375px baseline) and enhanced for larger screens. Touch targets are a minimum of 44×44px. Bottom navigation avoids overlap with content.

### Type Safety

All code is strict TypeScript with zero `any` types. API responses are mapped to normalized `Article` types before use.

## Known Limitations

- Abstract reconstruction requires OpenAlex's `abstract_inverted_index` field, which is sparse. Many articles have no abstract.
- Full-text URLs depend on OpenAlex's aggregated OA data; some records may have stale or broken URLs.
- Offline support is limited to articles already cached by the service worker; new searches require network access.

## License

Open source and available under the MIT License.
