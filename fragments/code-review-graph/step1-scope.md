Graph-powered scope (`features.code-review-graph` enabled):

1. `detect_changes(detail_level="minimal")` — risk-scored changed file list with severity ratings
2. `get_bridge_nodes_tool` — identify architectural choke points (flag for architecture-reviewer)
3. `get_affected_flows` — identify impacted execution paths (pass to test-reviewer as scope context)
