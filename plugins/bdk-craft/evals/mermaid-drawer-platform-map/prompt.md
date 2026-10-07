---
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Draw our whole platform in a diagram: web app, mobile app, admin app, CDN, API gateway, auth service, users service, catalog service, search service backed by Elasticsearch, cart service backed by Redis, orders service, payments service calling Stripe, invoices service writing PDFs to S3, notifications service calling SendGrid and Twilio, a Kafka cluster between orders, payments, invoices and notifications, Postgres for users, catalog and orders, and Grafana reading metrics from all services.
