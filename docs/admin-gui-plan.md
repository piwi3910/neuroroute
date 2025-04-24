# Admin GUI Technology Plan

## Objective

This document outlines the chosen technology stack and high-level implementation plan for the administrative web GUI for the Neuroroute API.

## Backend Context

The existing backend is a Neuroroute API built with:

*   Fastify 5
*   TypeScript
*   Prisma
*   Zod for validation
*   Configured as an ES Module project

## Technology Choice: Vite + React + TypeScript

After evaluating several options, **Vite + React + TypeScript** was selected as the most suitable stack for the admin GUI.

### Rationale

*   **Compatibility:** Seamlessly integrates with the Fastify backend via standard REST API calls and JWT handling.
*   **Developer Experience (DX):** Vite offers exceptionally fast HMR and build times. React provides a vast ecosystem and strong TypeScript support.
*   **Suitability for CSR:** Ideal for Client-Side Rendered (CSR) applications like an admin panel where SEO is not a primary concern.
*   **Rich Ecosystem:** Access to numerous mature UI component libraries (e.g., Mantine, MUI, Chakra UI), state management tools (e.g., Zustand, Jotai), and data fetching libraries (e.g., TanStack Query).

### Alternatives Considered

*   **Next.js:** Powerful but likely overkill due to its focus on SSR/SSG and added complexity (Server Components) not required for a CSR admin panel.
*   **Vite + Vue:** A solid alternative, very similar in suitability. The choice often comes down to team preference.
*   **SvelteKit:** Offers excellent performance but has a smaller ecosystem and its integrated framework features might be slightly excessive for a pure CSR application.

## High-Level Implementation Plan

1.  **Project Setup:**
    *   Create a new directory `neuroroute-admin-gui` alongside `neuroroute-api`.
    *   Initialize a Vite project using the React + TypeScript template within `neuroroute-admin-gui`.
2.  **Core Dependencies:**
    *   Install essential libraries: `axios` (API calls), `react-router-dom` (routing), and a UI component library (e.g., Mantine UI recommended).
3.  **API Integration & Environment:**
    *   Configure Vite `.env` files for the `VITE_API_BASE_URL`.
    *   Develop an API service module for handling requests and JWT authentication headers.
    *   Set up Vite's development proxy (`vite.config.ts`) to forward `/api` requests to the Fastify backend, avoiding CORS issues locally.
4.  **Authentication:**
    *   Implement Login/Logout components and associated logic.
    *   Securely store the JWT upon successful login (e.g., in memory or httpOnly cookie via backend).
    *   Establish protected routes accessible only to authenticated users.
5.  **Basic Structure & Features:**
    *   Implement a main application layout (e.g., Sidebar navigation + Content Area).
    *   Create initial placeholder pages/components for key admin functionalities (e.g., User Management, Configuration Settings, Audit Logs) based on available API endpoints.
6.  **Deployment Strategy:**
    *   Define and plan the deployment approach (e.g., static hosting on Vercel/Netlify, or serving built static assets).

## Visual Overview

```mermaid
graph LR
    subgraph "Browser"
        AdminGUI[Admin Web GUI (Vite + React)]
    end

    subgraph "Server Infrastructure"
        FastifyAPI[neuroroute-api (Fastify)]
        Database[(Prisma + Database)]
    end

    AdminGUI -- HTTPS API Calls --> FastifyAPI
    FastifyAPI -- Database Queries --> Database

    style AdminGUI fill:#ccf,stroke:#333,stroke-width:2px
    style FastifyAPI fill:#f9f,stroke:#333,stroke-width:2px