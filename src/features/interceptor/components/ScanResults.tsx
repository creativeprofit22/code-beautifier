"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Info,
  Shield,
  ExternalLink,
  Download,
} from "lucide-react";
import { downloadAsJson } from "@/lib/download";

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  location: string;
  recommendation: string;
  cweId?: string;
  references?: string[];
}

interface ScanResultsProps {
  findings: Finding[];
  scanTime?: Date;
  duration?: number;
}

function getHostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url; // Return raw string if URL is invalid
  }
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    Icon: AlertCircle,
    iconClass: "text-red-500",
    badgeClass: "border-red-500/30 bg-red-500/10 text-red-400",
    groupBg: "bg-red-500/5",
    groupBorder: "border-red-500/20",
  },
  HIGH: {
    Icon: AlertTriangle,
    iconClass: "text-orange-500",
    badgeClass: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    groupBg: "bg-orange-500/5",
    groupBorder: "border-orange-500/20",
  },
  MEDIUM: {
    Icon: AlertTriangle,
    iconClass: "text-yellow-500",
    badgeClass: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    groupBg: "bg-yellow-500/5",
    groupBorder: "border-yellow-500/20",
  },
  LOW: {
    Icon: Info,
    iconClass: "text-blue-500",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    groupBg: "bg-blue-500/5",
    groupBorder: "border-blue-500/20",
  },
} as const;

function SeverityIcon({ severity }: { severity: SeverityLevel }) {
  const { Icon, iconClass } = SEVERITY_CONFIG[severity];
  return <Icon className={`h-5 w-5 ${iconClass}`} />;
}

function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_CONFIG[severity].badgeClass}`}>
      {severity}
    </span>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-800/30"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
        )}
        <SeverityIcon severity={finding.severity} />
        <span className="flex-1 text-sm font-medium text-zinc-200">{finding.title}</span>
        <SeverityBadge severity={finding.severity} />
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-800 p-4">
          <div className="space-y-4">
            {/* Description */}
            <div>
              <h4 className="mb-1 text-xs font-medium tracking-wider text-zinc-500 uppercase">
                Description
              </h4>
              <p className="text-sm text-zinc-300">{finding.description}</p>
            </div>

            {/* Location */}
            <div>
              <h4 className="mb-1 text-xs font-medium tracking-wider text-zinc-500 uppercase">
                Location
              </h4>
              <code className="rounded bg-zinc-950 px-2 py-1 font-mono text-xs text-violet-400">
                {finding.location}
              </code>
            </div>

            {/* Recommendation */}
            <div>
              <h4 className="mb-1 text-xs font-medium tracking-wider text-zinc-500 uppercase">
                Recommendation
              </h4>
              <p className="text-sm text-zinc-300">{finding.recommendation}</p>
            </div>

            {/* CWE ID */}
            {finding.cweId && (
              <div>
                <h4 className="mb-1 text-xs font-medium tracking-wider text-zinc-500 uppercase">
                  CWE Reference
                </h4>
                <a
                  href={`https://cwe.mitre.org/data/definitions/${finding.cweId.replace("CWE-", "")}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300"
                >
                  {finding.cweId}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* References */}
            {finding.references && finding.references.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-medium tracking-wider text-zinc-500 uppercase">
                  References
                </h4>
                <ul className="space-y-1">
                  {finding.references.map((ref, index) => (
                    <li key={index}>
                      <a
                        href={ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300"
                      >
                        {getHostnameFromUrl(ref)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityGroup({
  severity,
  findings,
  defaultExpanded = false,
}: {
  severity: SeverityLevel;
  findings: Finding[];
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (findings.length === 0) return null;

  const { groupBg, groupBorder } = SEVERITY_CONFIG[severity];

  return (
    <div className={`rounded-xl border ${groupBorder} ${groupBg}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        )}
        <SeverityIcon severity={severity} />
        <span className="flex-1 text-sm font-semibold text-zinc-200">{severity}</span>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
          {findings.length} {findings.length === 1 ? "finding" : "findings"}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-2 p-4 pt-0">
          {findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ScanResults({ findings, scanTime, duration }: ScanResultsProps) {
  const criticalFindings = findings.filter((f) => f.severity === "CRITICAL");
  const highFindings = findings.filter((f) => f.severity === "HIGH");
  const mediumFindings = findings.filter((f) => f.severity === "MEDIUM");
  const lowFindings = findings.filter((f) => f.severity === "LOW");

  const hasFindings = findings.length > 0;

  const handleExport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      scanTime: scanTime?.toISOString(),
      duration,
      summary: {
        total: findings.length,
        critical: criticalFindings.length,
        high: highFindings.length,
        medium: mediumFindings.length,
        low: lowFindings.length,
      },
      findings,
    };
    downloadAsJson(report, `security-scan-${new Date().toISOString().split("T")[0]}.json`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-violet-500" />
          <span className="text-sm font-medium text-zinc-200">Security Scan Results</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          {scanTime && (
            <span>
              Scanned{" "}
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(scanTime)}
            </span>
          )}
          {duration !== undefined && <span>{formatDuration(duration)}</span>}
          <span className={`font-medium ${hasFindings ? "text-yellow-400" : "text-green-400"}`}>
            {findings.length} {findings.length === 1 ? "issue" : "issues"} found
          </span>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Results */}
      {!hasFindings ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5">
          <Shield className="h-8 w-8 text-green-500" />
          <span className="text-sm font-medium text-green-400">No security issues found</span>
          <span className="text-xs text-zinc-500">Your application passed all security checks</span>
        </div>
      ) : (
        <div className="space-y-3">
          <SeverityGroup severity="CRITICAL" findings={criticalFindings} defaultExpanded={true} />
          <SeverityGroup
            severity="HIGH"
            findings={highFindings}
            defaultExpanded={criticalFindings.length === 0}
          />
          <SeverityGroup severity="MEDIUM" findings={mediumFindings} />
          <SeverityGroup severity="LOW" findings={lowFindings} />
        </div>
      )}
    </div>
  );
}
