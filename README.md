# QuickNotes System Design & API Client

A high-performance frontend API client prototype and comprehensive distributed system design specification for **QuickNotes**, designed to scale from a browser-based application to a cloud service supporting **1,000,000 users**.

---

## 📖 Project Overview

QuickNotes enables users to capture, organize, and manage notes seamlessly. This project consists of two core engineering deliverables:

1. **Frontend API Client (`index.html`, `style.css`, `api.js`):**
   - An interactive REST client communicating with the JSONPlaceholder mock API.
   - Fully implements `GET` (load 10 notes), `POST` (create note with validation), and `DELETE` (remove note).
   - Demonstrates robust asynchronous state management: loading, success, error, and empty states.
   - Enforces security best practices by strictly inserting user text via `textContent` to prevent Cross-Site Scripting (XSS).
   - Accessible and responsive interface built with clean semantic HTML and modern CSS.

2. **Backend System Architecture & Design Documentation (`docs/`):**
   - Professional system design specifications ready for backend engineering teams to implement.
   - Covers RESTful API design, relational data modeling (PostgreSQL), capacity planning for 1M users, distributed architecture diagrams, request flows, trade-offs, and single-point-of-failure (SPOF) elimination.

---

## 🚀 How to Run the API Client

No build tools, bundlers, or package installations are required.

### Option 1: Open Directly in Browser

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/quicknotes-system-design.git
   cd quicknotes-system-design
   ```
2. Double-click `index.html` or open it in any modern web browser (Google Chrome, Firefox, Safari, Microsoft Edge).

### Option 2: Run with a Local Static Server

If you prefer a local server environment (e.g. VS Code Live Server or Python):

```bash
# Using Python 3
python -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

---

## 📚 System Design Documentation

Detailed engineering documentation is located in the [`docs/`](docs/) directory:

- 📋 [**API Design Document**](docs/api-design.md)  
  _Covers 7 RESTful endpoints, request/response JSON payloads for creating and listing notes, and RFC-compliant error status codes (`400`, `401`, `403`, `404`, `500`)._

- 🗄️ [**Data Model Document**](docs/data-model.md)  
  _Details the relational schema across `users`, `notes`, `tags`, and `note_tags`, complete with `CREATE TABLE` DDL, 1:N and M:N relationships, indexes with justifications, SQL queries with `JOIN` operations, and SQL vs. NoSQL evaluation._

- 🏗️ [**System Architecture Document**](docs/architecture.md)  
  _Includes functional and non-functional requirements, capacity calculations for 1,000,000 users (QPS and storage projections), distributed component architecture diagram, step-by-step lifecycle flows for `GET` and `POST`, engineering trade-offs, and high-availability SPOF avoidance._

---

## 💡 What I Learned

1. **Robust Asynchronous State Handling in JavaScript:**  
   Mastered writing resilient network code by encapsulating `fetch` within a reusable `request()` wrapper that checks `response.ok`, throws descriptive errors, and wraps requests in `try / catch / finally` blocks. Learned to provide clear visual feedback across all four operational states: loading indicator, success confirmation, actionable error messages, and empty list placeholders.

2. **Distributed Systems & Capacity Planning:**  
   Learned how to conduct back-of-the-envelope capacity estimations for 1 million users, translating registered user counts into Queries Per Second (QPS) and annual storage accumulation. Recognized that QuickNotes has an 80/20 read-heavy workload ($4:1$ read-to-write ratio), making the **Cache-Aside pattern** with Redis and **Primary-Replica database replication** ideal architectural solutions.

3. **Relational Modeling & Architectural Trade-offs:**  
   Understood how to design normalized schemas with 1-to-many and many-to-many junction tables, enforce referential integrity with `ON DELETE CASCADE`, and optimize query throughput with B-Tree indexes. Evaluated real-world engineering trade-offs, particularly balancing **Cache Speed vs. Data Freshness** and **Availability vs. Eventual Consistency** under asynchronous database replication.
