// Stub of the v3 kernel entry point, so allowed-tools rules can be tested
// against the real path shape `node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs <args>`.
console.log(`pong ${process.argv.slice(2).join(" ")}`.trim());
