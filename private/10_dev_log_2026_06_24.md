# My CodeMesh Developer Log & Learning Documentation
**Date: June 24, 2026**

---

## 1. What I Accomplished Today

Today, I laid the foundation for the **CodeMesh React Frontend** and successfully integrated its first vertical feature slice: **Authentication (Signup and Login)**. 

Specifically, I:
1. **Initialized the frontend application** using React and JavaScript powered by Vite.
2. **Created a custom vanilla CSS design system** under `src/index.css` configured for a sleek dark mode interface.
3. **Set up ESLint** as my primary code linter to catch errors early.
4. **Built a centralized API client** (`src/api.js`) to handle server communication.
5. **Developed the stateful Auth UI** (`src/Auth.jsx`) that supports both signup and login form states.
6. **Configured the global authentication state** in `src/App.jsx` to manage login/logout state and persist active sessions.

---

## 2. Rationale Behind My Technical Decisions

* **Vertical Feature Development:** Instead of trying to build the entire backend before writing a single line of frontend, I decided to develop features vertically. This ensures the frontend layout and backend APIs are validated together, avoiding mismatched payload expectations.
* **Vanilla CSS Design System:** I chose to define my design system using pure CSS custom variables rather than relying on a heavy utility framework. This gives me complete flexibility, keeps the file sizes minimal, and simplifies theme customization.
* **Vite Tooling:** I used Vite with standard React and JavaScript templates to keep build and reload times fast, avoiding the compile-time overhead of more complex configurations.

---

## 3. Code Explanations

Here is a breakdown of the code I wrote and how each module functions:

### A. Centralized API Client (`src/api.js`)
This is the communication hub between my React components and my Node.js Express server (`http://localhost:5000/api/v1`).

```javascript
const BASE_URL = 'http://localhost:5000/api/v1';

export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
};
```
* **Key Functionality:**
  * It abstracts the details of base API paths, automatic headers, and response serialization so I don't have to duplicate this setup for every API request.
  * It checks `localStorage` for a `token` and, if present, automatically injects the `Authorization: Bearer <token>` header, securing backend requests automatically.
  * It standardizes error handling, converting unsuccessful HTTP status responses into catchable errors.

### B. Stateful Auth Component (`src/Auth.jsx`)
This component renders my forms, manages active inputs, and handles calls to both the register and login endpoints.

* **Key Functionality:**
  * **Toggle UI:** Toggles a state (`isLogin`) to show or hide the `username` field and change the submit buttons dynamically.
  * **Unified Input Handler:** Uses a simple handler to bind input fields dynamically to a single form object.
  * **Local Storage Integration:** Persists both the auth token and the deserialized user object on the browser, allowing automatic login.
  * **Callback Hook:** Emits a parent callback (`onAuthSuccess`) to bubble up success details to the core application layout.

### C. Root Application Controller (`src/App.jsx`)
Handles whether a logged-in dashboard view or the gateway login screen is visible to users.

* **Key Functionality:**
  * **Session Persistence:** Automatically checks for a cached session inside `localStorage` on page load. If present, it sets user state directly.
  * **Protected Content Layout:** Intercepts unauthenticated navigation and forces rendering of the login page.
  * **Session Cleanup (Logout):** Deletes tokens and profiles from storage and clears global state to re-trigger the login view.

### D. CSS Theme Configuration (`src/index.css`)
Contains all theme variables, font weights, layout systems, and responsive adjustments.
* **Variable usage:** Establishes reusable tokens for layout backgrounds, borders, active accents, fonts, and transitions.
* **Cross-Browser Tweaks:** Includes dual standard/prefixed configurations for font-smoothing (`-webkit-font-smoothing` and `-moz-osx-font-smoothing`) and text gradient clipping (`background-clip`) to avoid layout warnings on different engines.

---

## 4. Topics of Doubt and Explanations

### Linter Selection (ESLint vs. Oxlint)
I researched whether to use ESLint or Oxlint to ensure code cleanliness. While Oxlint is written in Rust and provides extremely fast syntax linting, it does not fully support comprehensive rules for checking React Hook dependency tables (`eslint-plugin-react-hooks`) yet. Therefore, I decided to keep the ESLint setup that Vite automatically configured for my React app. It integrates better with code editors and guarantees proper validation of my React render lifecycles.

### Centralized API Utilities
I evaluated the utility of creating `api.js` versus making direct `fetch()` calls in individual screens. I found that direct fetches require duplicating configuration variables, handling token authorization headers manually on every page, and repeating error parsing logic. Writing the `apiRequest` helper wrapper resolves these concerns by providing single-point URL updates, automatic JWT attachment, and unified response verification.

### Development Sequence Workflow
I considered whether to completely finalize my backend before starting my frontend application. I realized that a strict sequential flow leads to API contract mismatches and integration bottlenecks. Adopting a vertical-slicing method, where I implement frontend pages alongside backend endpoints feature-by-feature, ensures that data structures are validated against actual client needs early and allows me to test components end-to-end immediately.
