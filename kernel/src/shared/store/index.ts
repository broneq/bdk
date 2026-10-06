export { checkpointModule } from "./config.ts";
export { fileStore, findProjectRoot, memoryStore, readStdin } from "./store.ts";
export { addedLines, changeBase, EMPTY_TREE } from "./base.ts";
export type { FileStat, Store } from "./store.ts";
export { splitFrontmatter } from "./frontmatter.ts";
export { findExecutable } from "./which.ts";
export type { ExecutableLookup } from "./which.ts";
export { INDEX_SCHEMA_VERSION } from "./index/schema.ts";
export {
  AGENTS_SCHEMA_VERSION,
  agentsRegistryPath,
  fileHeartbeat,
  fileRegistry,
  heartbeatPath,
  memoryRegistry,
  openAgentRegistry,
  withRegistry,
} from "./agents/registry.ts";
export type {
  AgentFields,
  AgentRegistry,
  AgentRow,
  EndedBy,
  Heartbeat,
  HeartbeatReader,
  MessageRow,
  RegistryOpener,
  SessionRow,
} from "./agents/registry.ts";
export { fileIndex, indexPath, memoryIndex, openIndex, withIndex } from "./index/open.ts";
export type { IndexDb, IndexOpener, OpenOptions } from "./index/open.ts";
export { rebuildChange, refreshAll, refreshChange } from "./index/refresh.ts";
export {
  findChangeRow,
  findEntry,
  hasAttempt,
  listAllEntries,
  listAttemptFindings,
  listChanges,
  listEntries,
  openAttempts,
  selectReadOnly,
} from "./index/queries.ts";
export type {
  AttemptFindingRow,
  ChangeRow,
  EntryFilter,
  EntryRow,
  OpenAttempt,
  SelectResult,
} from "./index/queries.ts";
export { migrateDocument, readChange, readDocument, writeDocument } from "./state/documents.ts";
export { frontmatterFile, renderDocument } from "./state/render.ts";
export type { KindOverrides, MigrationResult, StateDocument } from "./state/documents.ts";
export { findingFingerprint, learningFingerprint, normalise } from "./state/fingerprint.ts";
export { generateDesignIndex, generatePlanIndex, planWaves } from "./state/indexes.ts";
export {
  hasPlaceholder,
  isolationOf,
  parsePlanTasks,
  planPlaceholders,
  TASK_ID,
} from "./state/plan.ts";
export type { Isolation, ParsedTasks, PlanFile, PlanTask } from "./state/plan.ts";
export { STATE_KINDS } from "./state/registry.ts";
export type { KindName } from "./state/registry.ts";
export {
  archivedChangeDir,
  findChange,
  listChangeDirs,
  listMarkers,
  liveChangeDir,
  readMarker,
  removeMarker,
  resolveActiveChange,
  writeMarker,
} from "./changes.ts";
export type { ChangeLocation } from "./changes.ts";
export { ensureFormatterGuard, FORMATTER_GUARD, formatterGuardState } from "./formatter-guard.ts";
export type { FormatterGuardState } from "./formatter-guard.ts";
export { ensureIgnored, IGNORED_PATHS, onlyKernelIgnores } from "./ignore.ts";
export { filesOverlap, firstMatch, matchesGlob } from "./glob.ts";
export { secondStamp } from "./state/common.ts";
export { entryPath, writeEntry } from "./state/ledger.ts";
export type { WrittenEntry } from "./state/ledger.ts";
export {
  effectiveProfile,
  isConfirmed,
  isProfile,
  parkedQuestion,
  profileRank,
  stageOf,
  supersededBy,
} from "./state/derived.ts";
export type { EntryFacts, StageMap } from "./state/derived.ts";
export {
  appendTelemetry,
  halveTelemetry,
  telemetryPath,
  TELEMETRY_LIMIT_BYTES,
} from "./telemetry.ts";
export { appendJournal, JOURNAL_LIMIT_BYTES, journalLine, journalPath } from "./journal.ts";
export type { JournalLine, JournalOptions } from "./journal.ts";
export { checkpointChange } from "./checkpoint.ts";
export type { Checkpoint, CheckpointInput } from "./checkpoint.ts";
export { processLockWait, withLock } from "./lock.ts";
export type { LockHolder, LockWait } from "./lock.ts";
export { taskProgress } from "./progress.ts";
export type { TaskProgress } from "./progress.ts";
export { rebuildChanges } from "./rebuild.ts";
export {
  gitDirIn,
  HOME_MARKER,
  homeIsValid,
  homeMarkerPath,
  kernelWorktrees,
  partBranch,
  partWorktree,
  readHomeMarker,
  workRootOf,
  workRoots,
  writeHomeMarker,
} from "./worktree.ts";
export type { HomeMarker } from "./worktree.ts";
export type { RebuildResult } from "./rebuild.ts";
export { readAttempts, readPlanParts, targetFiles, taskHolders } from "./work.ts";
export { stampRulesRead } from "./rules-read.ts";
export {
  activePackage,
  agentReport,
  openPackage,
  packageRoles,
  partManifests,
  MERGE_GROUP,
  mergeReportName,
  readManifests,
  resolveTicketRef,
  stampPackage,
  ticketManifests,
} from "./tickets.ts";
export type { ActivePackage, ManifestFile, ResolvedRef, TicketDeps } from "./tickets.ts";
export type { DispatchPackage } from "./state/dispatch.ts";
export type { EvidenceManifest } from "./state/evidence.ts";
export type { AttemptFile, PlanPartFile, PlanPartFrontmatter } from "./work.ts";
export type { AttemptRecord } from "./state/attempt.ts";
export { pruneChange } from "./prune.ts";
export {
  readRunMarker,
  removeRunMarker,
  runMarkerPath,
  SESSION_ID,
  writeRunMarker,
} from "./runs.ts";
export type { RunMarker } from "./runs.ts";
