---
name: Project requirments
description: Project requirements
---

# Project-Specific Engineering Rules

Follow the project's existing architecture, conventions, and stack unless there is a strong engineering reason to improve them.

Before introducing changes:

- analyze existing patterns
- preserve consistency
- minimize breaking changes
- maintain backward compatibility when possible

---

# Tech Stack Policy

Prefer modern, stable, and production-proven technologies.

Default preferences:

## Frontend

- TypeScript
- React
- Next.js
- Tailwind CSS
- React Query / TanStack Query
- Zustand or Redux Toolkit when needed
- Zod for validation

## Backend

- Node.js (latest LTS)
- TypeScript
- NestJS / Fastify
- Python for data/AI workloads
- REST or gRPC where appropriate

## Databases

- PostgreSQL as primary relational DB
- Redis for caching/queues
- Elasticsearch/OpenSearch when search is required

## Infrastructure

- Docker
- Kubernetes where scale justifies it
- Terraform
- GitHub Actions

---

# API Standards

APIs must be:

- versioned
- typed
- validated
- documented

Use:

- OpenAPI/Swagger
- schema validation
- consistent error responses
- pagination
- rate limiting

---

# TypeScript Standards

Always:

- enable strict mode
- avoid any
- use explicit types
- prefer readonly where possible
- avoid unsafe casting

Prefer:

- discriminated unions
- type inference
- utility types
- schema-first validation

---

# React Standards

Prefer:

- server components where beneficial
- functional components
- hooks
- composition
- isolated reusable components

Avoid:

- prop drilling
- oversized components
- unnecessary global state
- excessive effects

Optimize rendering behavior.

---

# Next.js Standards

Prefer:

- App Router
- server-side rendering where useful
- edge runtime only when justified
- route handlers
- streaming/Suspense where beneficial

Optimize:

- SEO
- caching
- bundle size
- Core Web Vitals

---

# Backend Service Standards

Services should be:

- modular
- observable
- independently testable

Always implement:

- validation
- logging
- metrics
- graceful error handling

Prefer:

- message queues for async workloads
- idempotent handlers
- transactional integrity

---

# Database Rules

Always:

- create migrations
- add indexes intentionally
- review query performance
- use transactions appropriately

Never:

- expose raw DB errors
- trust ORM blindly
- ignore execution plans

---

# Git Standards

Commits must be:

- atomic
- descriptive
- reviewable

Prefer:

- conventional commits
- small pull requests
- code reviews
- CI validation before merge

---

# CI/CD Standards

Pipelines must include:

- linting
- type checking
- tests
- security checks
- build validation

Deployments should support:

- rollback
- health verification
- zero-downtime strategies where possible

---

# Security Rules

Mandatory:

- dependency scanning
- secret scanning
- validation layers
- authentication middleware
- authorization checks

Never expose:

- internal stack traces
- secrets
- infrastructure details

---

# Performance Rules

Measure and monitor:

- latency
- throughput
- memory usage
- database performance

Use profiling before optimization.

---

# AI Coding Rules

When modifying code:

1. First analyze architecture and conventions.
2. Explain potential risks.
3. Preserve compatibility.
4. Avoid unnecessary rewrites.
5. Prefer incremental improvements.
6. Keep solutions production-grade.
7. Ensure generated code is complete and executable.
8. Never invent non-existent APIs or libraries.
9. Mention assumptions explicitly.
10. Prefer maintainable solutions over trendy ones.