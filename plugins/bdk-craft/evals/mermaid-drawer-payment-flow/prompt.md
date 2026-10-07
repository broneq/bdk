---
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Draw how a payment is processed: the checkout page sends the payment to our payments service, which calls the card provider; on success the order is marked paid and the customer gets a receipt e-mail; on a decline the customer sees an error; on a provider timeout we retry twice and then mark the payment as pending for manual review. Make the failure paths stand out.
