mod config;
mod history;
mod report;

use std::{
    fs,
    path::{Path, PathBuf},
    process::ExitCode,
};

use anyhow::{bail, Context, Result};
use clap::{Args, Parser, Subcommand, ValueEnum};
use config::{AppConfig, DEFAULT_CONFIG};
use history::{find_change_origin, first_regression, load_baseline, load_history, record_capture, set_baseline};
use releasetruth_core::{
    classify_changes, compare, fingerprint_snapshot, load_behavior_lock, normalize_snapshot,
    score_comparison, verify_fingerprint, BehaviorLock, Severity, SUPPORTED_SCHEMA,
};
use report::ReportFormat;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(
    name = "releasetruth",
    version,
    about = "Evidence-backed behavioral diffs between application releases"
)]
struct Cli {
    #[arg(long, global = true, help = "Increase diagnostic logging")]
    verbose: bool,
    #[arg(long, global = true, help = "Suppress non-report informational output")]
    quiet: bool,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Initialize ReleaseTruth configuration in the current project.
    Init(InitArgs),
    /// Validate local setup, configuration, and behavior-lock files.
    Doctor(DoctorArgs),
    /// Finalize an adapter-produced draft into a normalized behavior.lock.json.
    Capture(CaptureArgs),
    /// Compare two behavior.lock.json files.
    Compare(CompareArgs),
    /// Compute or verify a behavior fingerprint.
    Fingerprint(FingerprintArgs),
    /// Set or inspect the local behavioral baseline.
    Baseline(BaselineArgs),
    /// Record or inspect deterministic capture history.
    History(HistoryArgs),
    /// Find the first recorded release containing a deterministic change id.
    Blame(BlameArgs),
    /// Find the first recorded release that crosses a severity threshold.
    Bisect(BisectArgs),
}

#[derive(Args)]
struct InitArgs {
    #[arg(long, default_value = ".releasetruth.yml")]
    config: PathBuf,
    #[arg(long, help = "Replace an existing configuration file")]
    force: bool,
}

#[derive(Args)]
struct DoctorArgs {
    #[arg(long, default_value = ".releasetruth.yml")]
    config: PathBuf,
    #[arg(long, help = "Optional behavior lock to verify")]
    lock: Option<PathBuf>,
}

#[derive(Args)]
struct CaptureArgs {
    #[arg(long, help = "Adapter-produced draft behavior lock JSON")]
    input: PathBuf,
    #[arg(
        long,
        default_value = ".releasetruth/capture",
        help = "Output directory or .json file"
    )]
    output: PathBuf,
    #[arg(long, help = "Override release label stored in the capture")]
    release: Option<String>,
    #[arg(long, default_value = ".releasetruth.yml")]
    config: PathBuf,
    #[arg(long, help = "Record the finalized lock in local history")]
    record_history: bool,
    #[arg(long, help = "Git commit associated with this capture")]
    git_sha: Option<String>,
}

#[derive(Args)]
struct CompareArgs {
    base: PathBuf,
    candidate: PathBuf,
    #[arg(long, value_enum, default_value = "text")]
    format: ReportFormat,
    #[arg(long, help = "Write report to a file instead of stdout")]
    output: Option<PathBuf>,
    #[arg(long, default_value = ".releasetruth.yml")]
    config: PathBuf,
    #[arg(
        long,
        value_enum,
        default_value = "breaking",
        help = "Exit 2 when a change at or above this severity exists"
    )]
    fail_on: FailOn,
}

#[derive(Args)]
struct FingerprintArgs {
    lock: PathBuf,
    #[arg(
        long,
        help = "Verify stored fingerprint instead of printing a computed one"
    )]
    verify: bool,
}

#[derive(Args)]
struct BaselineArgs {
    #[arg(help = "Behavior lock to set as baseline; omit to inspect current baseline")]
    lock: Option<PathBuf>,
    #[arg(long, default_value = ".releasetruth/baseline.json")]
    store: PathBuf,
}

#[derive(Args)]
struct HistoryArgs {
    #[arg(long, help = "Behavior lock to append to history")]
    record: Option<PathBuf>,
    #[arg(long, help = "Git commit associated with --record")]
    git_sha: Option<String>,
    #[arg(long, default_value = ".releasetruth/history.json")]
    store: PathBuf,
    #[arg(long, default_value_t = 20)]
    limit: usize,
}

#[derive(Args)]
struct BlameArgs {
    #[arg(help = "Baseline behavior lock used as comparison origin")]
    base: PathBuf,
    #[arg(help = "Stable ReleaseTruth change id, for example chg-...")]
    change_id: String,
    #[arg(long, default_value = ".releasetruth/history.json")]
    history: PathBuf,
    #[arg(long, default_value = ".releasetruth.yml")]
    config: PathBuf,
}

#[derive(Args)]
struct BisectArgs {
    #[arg(help = "Baseline behavior lock used as comparison origin")]
    base: PathBuf,
    #[arg(long, default_value = ".releasetruth/history.json")]
    history: PathBuf,
    #[arg(long, default_value = ".releasetruth.yml")]
    config: PathBuf,
    #[arg(long, value_enum, default_value = "breaking")]
    fail_on: FailOn,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum FailOn {
    Never,
    Breaking,
    Significant,
    Minor,
}

impl FailOn {
    fn threshold(self) -> Option<u8> {
        match self {
            FailOn::Never => None,
            FailOn::Breaking => Some(Severity::Breaking.rank()),
            FailOn::Significant => Some(Severity::Significant.rank()),
            FailOn::Minor => Some(Severity::Minor.rank()),
        }
    }
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let filter = if cli.verbose { "debug" } else { "warn" };
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::new(filter))
        .with_target(false)
        .with_writer(std::io::stderr)
        .init();

    match run(cli) {
        Ok(code) => code,
        Err(error) => {
            eprintln!("error: {error:#}");
            ExitCode::from(1)
        }
    }
}

fn run(cli: Cli) -> Result<ExitCode> {
    match cli.command {
        Command::Init(args) => init(args, cli.quiet),
        Command::Doctor(args) => doctor(args, cli.quiet),
        Command::Capture(args) => capture(args, cli.quiet),
        Command::Compare(args) => compare_command(args),
        Command::Fingerprint(args) => fingerprint(args),
        Command::Baseline(args) => baseline(args, cli.quiet),
        Command::History(args) => history_command(args, cli.quiet),
        Command::Blame(args) => blame(args),
        Command::Bisect(args) => bisect(args),
    }
}

fn init(args: InitArgs, quiet: bool) -> Result<ExitCode> {
    if args.config.exists() && !args.force {
        bail!(
            "configuration `{}` already exists; use --force to replace it",
            args.config.display()
        );
    }
    if let Some(parent) = args
        .config
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create `{}`", parent.display()))?;
    }
    fs::write(&args.config, DEFAULT_CONFIG)
        .with_context(|| format!("failed to write `{}`", args.config.display()))?;
    fs::create_dir_all(".releasetruth")
        .context("failed to create .releasetruth runtime directory")?;
    if !quiet {
        println!(
            "Initialized ReleaseTruth\n  config: {}\n  schema: {}",
            args.config.display(),
            SUPPORTED_SCHEMA
        );
    }
    Ok(ExitCode::SUCCESS)
}

fn doctor(args: DoctorArgs, quiet: bool) -> Result<ExitCode> {
    let _config = AppConfig::load(&args.config)?;
    if !quiet {
        println!(
            "✓ configuration: {}",
            if args.config.exists() {
                args.config.display().to_string()
            } else {
                "defaults (no config file)".into()
            }
        );
        println!("✓ behavior schema: {SUPPORTED_SCHEMA}");
    }
    if let Some(path) = args.lock {
        let lock = read_lock(&path)?;
        if lock.fingerprint.is_empty() {
            bail!(
                "behavior lock `{}` has no fingerprint; finalize it with `releasetruth capture`",
                path.display()
            );
        }
        if !verify_fingerprint(&lock)? {
            bail!(
                "behavior lock `{}` fingerprint does not match its behavioral content",
                path.display()
            );
        }
        if !quiet {
            println!("✓ fingerprint verified: {}", path.display());
        }
    }
    Ok(ExitCode::SUCCESS)
}

fn capture(args: CaptureArgs, quiet: bool) -> Result<ExitCode> {
    let config = AppConfig::load(&args.config)?;
    let mut draft = read_lock(&args.input)?;
    if let Some(release) = args.release {
        draft.release = Some(release);
    }
    if draft.captured_at.trim().is_empty() {
        draft.captured_at = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    }
    let mut normalized = normalize_snapshot(&draft, &config.normalization)?;
    normalized.fingerprint = fingerprint_snapshot(&normalized)?;
    let destination = capture_destination(&args.output);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&destination, serde_json::to_vec_pretty(&normalized)?)
        .with_context(|| format!("failed to write `{}`", destination.display()))?;
    if args.record_history {
        record_capture(
            &destination,
            Path::new(".releasetruth/history.json"),
            args.git_sha,
        )?;
    }
    if !quiet {
        println!(
            "Captured behavioral contract\n  output: {}\n  fingerprint: {}",
            destination.display(),
            normalized.fingerprint
        );
    }
    Ok(ExitCode::SUCCESS)
}

fn compare_command(args: CompareArgs) -> Result<ExitCode> {
    let config = AppConfig::load(&args.config)?;
    let base = read_lock(&args.base)
        .with_context(|| format!("failed to load base `{}`", args.base.display()))?;
    let candidate = read_lock(&args.candidate)
        .with_context(|| format!("failed to load candidate `{}`", args.candidate.display()))?;
    let mut comparison = compare(&base, &candidate);
    classify_changes(&mut comparison.changes, &config.classification);
    let score = score_comparison(&comparison, &config.scoring);
    let rendered = report::render(args.format, &comparison, &score)?;
    if let Some(path) = args.output {
        if let Some(parent) = path.parent().filter(|path| !path.as_os_str().is_empty()) {
            fs::create_dir_all(parent)?;
        }
        fs::write(&path, rendered)
            .with_context(|| format!("failed to write report `{}`", path.display()))?;
    } else {
        print!("{rendered}");
        if !rendered.ends_with('\n') {
            println!();
        }
    }

    let should_fail = args.fail_on.threshold().is_some_and(|threshold| {
        comparison
            .changes
            .iter()
            .any(|change| change.severity.rank() >= threshold)
    });
    Ok(if should_fail {
        ExitCode::from(2)
    } else {
        ExitCode::SUCCESS
    })
}

fn fingerprint(args: FingerprintArgs) -> Result<ExitCode> {
    let lock = read_lock(&args.lock)?;
    if args.verify {
        if verify_fingerprint(&lock)? {
            println!("fingerprint verified: {}", lock.fingerprint);
            Ok(ExitCode::SUCCESS)
        } else {
            bail!("stored fingerprint does not match behavioral content")
        }
    } else {
        println!("{}", fingerprint_snapshot(&lock)?);
        Ok(ExitCode::SUCCESS)
    }
}

fn baseline(args: BaselineArgs, quiet: bool) -> Result<ExitCode> {
    if let Some(lock) = args.lock {
        let record = set_baseline(&lock, &args.store)?;
        if !quiet {
            println!(
                "Baseline set\n  release: {}\n  fingerprint: {}\n  lock: {}",
                record.release.as_deref().unwrap_or("unknown"),
                record.fingerprint,
                record.lock_path.display()
            );
        }
    } else {
        let record = load_baseline(&args.store)?;
        println!(
            "{}\t{}\t{}",
            record.release.as_deref().unwrap_or("unknown"),
            record.fingerprint,
            record.lock_path.display()
        );
    }
    Ok(ExitCode::SUCCESS)
}

fn history_command(args: HistoryArgs, quiet: bool) -> Result<ExitCode> {
    if let Some(lock) = args.record {
        let record = record_capture(&lock, &args.store, args.git_sha)?;
        if !quiet {
            println!(
                "Recorded {} ({})",
                record.release.as_deref().unwrap_or("unknown"),
                record.fingerprint
            );
        }
        return Ok(ExitCode::SUCCESS);
    }
    let history = load_history(&args.store)?;
    for record in history.records.iter().rev().take(args.limit) {
        println!(
            "{}\t{}\t{}\t{}",
            record.recorded_at,
            record.release.as_deref().unwrap_or("unknown"),
            record.git_sha.as_deref().unwrap_or("local"),
            record.fingerprint
        );
    }
    Ok(ExitCode::SUCCESS)
}

fn blame(args: BlameArgs) -> Result<ExitCode> {
    let config = AppConfig::load(&args.config)?;
    match find_change_origin(&args.base, &args.history, &args.change_id, &config.classification)? {
        Some(record) => {
            println!(
                "{}\t{}\t{}\t{}",
                args.change_id,
                record.release.as_deref().unwrap_or("unknown"),
                record.git_sha.as_deref().unwrap_or("local"),
                record.fingerprint
            );
            Ok(ExitCode::SUCCESS)
        }
        None => bail!("change `{}` was not found in recorded history", args.change_id),
    }
}

fn bisect(args: BisectArgs) -> Result<ExitCode> {
    let threshold = args
        .fail_on
        .threshold()
        .ok_or_else(|| anyhow::anyhow!("--fail-on never cannot identify a regression"))?;
    let config = AppConfig::load(&args.config)?;
    match first_regression(&args.base, &args.history, threshold, &config.classification)? {
        Some((record, count)) => {
            println!(
                "first regression: {}\n  git: {}\n  fingerprint: {}\n  changes at threshold: {}",
                record.release.as_deref().unwrap_or("unknown"),
                record.git_sha.as_deref().unwrap_or("local"),
                record.fingerprint,
                count
            );
            Ok(ExitCode::SUCCESS)
        }
        None => {
            println!("no recorded release crosses the requested severity threshold");
            Ok(ExitCode::SUCCESS)
        }
    }
}

fn read_lock(path: &Path) -> Result<BehaviorLock> {
    let bytes = fs::read(path).with_context(|| format!("failed to read `{}`", path.display()))?;
    load_behavior_lock(&bytes).map_err(Into::into)
}

fn capture_destination(output: &Path) -> PathBuf {
    if output.extension().and_then(|extension| extension.to_str()) == Some("json") {
        output.to_owned()
    } else {
        output.join("behavior.lock.json")
    }
}
