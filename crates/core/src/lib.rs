//! Deterministic core for ReleaseTruth.
//!
//! The core deliberately has no network, browser, process-execution, database, or AI
//! dependencies. Adapters produce observations; this crate makes those observations stable,
//! comparable, explainable, and scoreable.

pub mod canonical;
pub mod classify;
pub mod diff;
pub mod fingerprint;
pub mod migration;
pub mod model;
pub mod normalize;
pub mod score;

pub use classify::{classify_changes, ClassificationConfig};
pub use diff::{compare, Change, ChangeType, Comparison};
pub use fingerprint::{fingerprint_snapshot, verify_fingerprint};
pub use migration::{load_behavior_lock, MigrationError, SUPPORTED_SCHEMA};
pub use model::{BehaviorLock, EvidenceRef, Observation, Severity, Surface, Surfaces};
pub use normalize::{normalize_snapshot, NormalizationConfig, NormalizationRule};
pub use score::{score_comparison, ScoreBreakdown, ScoringConfig};
