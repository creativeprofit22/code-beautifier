"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Copy,
  Check,
  Shield,
  AlertTriangle,
  FileCode,
  Settings,
  Radio,
  Database,
  Lock,
  ChevronDown,
  ChevronRight,
  Package,
  ExternalLink,
} from "lucide-react";

type ManifestCategory =
  | "all"
  | "permissions"
  | "activities"
  | "services"
  | "receivers"
  | "providers";

interface ManifestViewerProps {
  manifest: {
    package: string;
    versionCode: string;
    versionName: string;
    minSdk: string;
    targetSdk: string;
    permissions: Array<{ name: string; protectionLevel?: string }>;
    activities: Array<{
      name: string;
      exported: boolean;
      intentFilters: Array<{ action?: string; category?: string; data?: string }>;
      permission?: string;
    }>;
    services: Array<{ name: string; exported: boolean; permission?: string }>;
    receivers: Array<{
      name: string;
      exported: boolean;
      intentFilters: Array<{ action?: string }>;
    }>;
    providers: Array<{
      name: string;
      exported: boolean;
      authorities?: string;
      permission?: string;
    }>;
    securityIssues: Array<{
      severity: "high" | "medium" | "low";
      issue: string;
      component?: string;
    }>;
    debuggable: boolean;
    allowBackup: boolean;
  };
  stats: {
    permissionCount: number;
    activityCount: number;
    serviceCount: number;
    receiverCount: number;
    providerCount: number;
    securityIssueCount: number;
  };
  fileName?: string;
}

interface CategoryTab {
  id: ManifestCategory;
  label: string;
  icon: React.ReactNode;
  count: number;
}

// Helper to get shortened class name (last segment after last dot)
function getShortName(fullName: string): string {
  const parts = fullName.split(".");
  return parts[parts.length - 1] || fullName;
}

// Protection level badge component
function ProtectionLevelBadge({ level }: { level?: string }) {
  const normalized = level?.toLowerCase() || "normal";

  if (normalized === "dangerous") {
    return (
      <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-xs font-medium text-red-400">
        dangerous
      </span>
    );
  }
  if (normalized === "signature") {
    return (
      <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs font-medium text-yellow-400">
        signature
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs font-medium text-green-400">
      normal
    </span>
  );
}

// Exported status indicator
function ExportedIndicator({
  exported,
  hasPermission,
}: {
  exported: boolean;
  hasPermission: boolean;
}) {
  if (!exported) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-900/50 px-2 py-0.5 text-xs font-medium text-green-400">
        <Lock className="h-3 w-3" aria-hidden="true" />
        private
      </span>
    );
  }
  if (hasPermission) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs font-medium text-yellow-400">
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
        exported (protected)
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-red-900/50 px-2 py-0.5 text-xs font-medium text-red-400">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      exported
    </span>
  );
}

// Security issue severity badge
function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-red-900/50 text-red-400 border-red-800",
    medium: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
    low: "bg-blue-900/50 text-blue-400 border-blue-800",
  };

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${styles[severity]}`}>
      {severity}
    </span>
  );
}

export function ManifestViewer({ manifest, stats, fileName }: ManifestViewerProps) {
  const [category, setCategory] = useState<ManifestCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Handler for category changes - also resets expanded items
  const handleCategoryChange = useCallback((newCategory: ManifestCategory) => {
    setCategory(newCategory);
    setExpandedItems(new Set());
  }, []);

  const categories: CategoryTab[] = useMemo(
    () => [
      {
        id: "all",
        label: "All",
        icon: <Package className="h-4 w-4" aria-hidden="true" />,
        count:
          stats.permissionCount +
          stats.activityCount +
          stats.serviceCount +
          stats.receiverCount +
          stats.providerCount,
      },
      {
        id: "permissions",
        label: "Permissions",
        icon: <Lock className="h-4 w-4" aria-hidden="true" />,
        count: stats.permissionCount,
      },
      {
        id: "activities",
        label: "Activities",
        icon: <FileCode className="h-4 w-4" aria-hidden="true" />,
        count: stats.activityCount,
      },
      {
        id: "services",
        label: "Services",
        icon: <Settings className="h-4 w-4" aria-hidden="true" />,
        count: stats.serviceCount,
      },
      {
        id: "receivers",
        label: "Receivers",
        icon: <Radio className="h-4 w-4" aria-hidden="true" />,
        count: stats.receiverCount,
      },
      {
        id: "providers",
        label: "Providers",
        icon: <Database className="h-4 w-4" aria-hidden="true" />,
        count: stats.providerCount,
      },
    ],
    [stats]
  );

  // Filter items by search query
  const filterBySearch = useCallback(
    <T extends { name: string }>(items: T[]): T[] => {
      if (!searchQuery.trim()) return items;
      const query = searchQuery.toLowerCase();
      return items.filter((item) => item.name.toLowerCase().includes(query));
    },
    [searchQuery]
  );

  const filteredPermissions = useMemo(
    () => filterBySearch(manifest.permissions),
    [filterBySearch, manifest.permissions]
  );
  const filteredActivities = useMemo(
    () => filterBySearch(manifest.activities),
    [filterBySearch, manifest.activities]
  );
  const filteredServices = useMemo(
    () => filterBySearch(manifest.services),
    [filterBySearch, manifest.services]
  );
  const filteredReceivers = useMemo(
    () => filterBySearch(manifest.receivers),
    [filterBySearch, manifest.receivers]
  );
  const filteredProviders = useMemo(
    () => filterBySearch(manifest.providers),
    [filterBySearch, manifest.providers]
  );

  const totalFilteredCount = useMemo(() => {
    switch (category) {
      case "permissions":
        return filteredPermissions.length;
      case "activities":
        return filteredActivities.length;
      case "services":
        return filteredServices.length;
      case "receivers":
        return filteredReceivers.length;
      case "providers":
        return filteredProviders.length;
      case "all":
      default:
        return (
          filteredPermissions.length +
          filteredActivities.length +
          filteredServices.length +
          filteredReceivers.length +
          filteredProviders.length
        );
    }
  }, [
    category,
    filteredPermissions,
    filteredActivities,
    filteredServices,
    filteredReceivers,
    filteredProviders,
  ]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(id);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedItem(null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Render permission item
  const renderPermission = (perm: { name: string; protectionLevel?: string }, index: number) => {
    const id = `perm-${index}`;
    return (
      <div
        key={id}
        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/50"
      >
        <Lock className="h-4 w-4 flex-shrink-0 text-violet-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <span className="block truncate font-mono text-sm text-zinc-300" title={perm.name}>
            {perm.name}
          </span>
        </div>
        <ProtectionLevelBadge level={perm.protectionLevel} />
        <button
          type="button"
          onClick={() => handleCopy(perm.name, id)}
          aria-label={copiedItem === id ? "Copied" : `Copy permission name`}
          className="flex-shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 focus:opacity-100"
        >
          {copiedItem === id ? (
            <Check className="h-4 w-4 text-green-400" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4 text-zinc-500" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  };

  // Render activity item
  const renderActivity = (
    activity: {
      name: string;
      exported: boolean;
      intentFilters: Array<{ action?: string; category?: string; data?: string }>;
      permission?: string;
    },
    index: number
  ) => {
    const id = `activity-${index}`;
    const hasDetails = activity.intentFilters.length > 0 || activity.permission;
    const isExpanded = expandedItems.has(id);

    return (
      <div key={id} className="transition-colors hover:bg-zinc-800/50">
        <div className="group flex items-center gap-3 px-4 py-3">
          {hasDetails ? (
            <button
              type="button"
              onClick={() => toggleExpanded(id)}
              className="flex-shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <FileCode className="h-4 w-4 flex-shrink-0 text-blue-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm text-zinc-300" title={activity.name}>
              {getShortName(activity.name)}
            </span>
            <span className="block truncate text-xs text-zinc-500" title={activity.name}>
              {activity.name}
            </span>
          </div>
          <ExportedIndicator exported={activity.exported} hasPermission={!!activity.permission} />
          <button
            type="button"
            onClick={() => handleCopy(activity.name, id)}
            aria-label={copiedItem === id ? "Copied" : `Copy activity name`}
            className="flex-shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 focus:opacity-100"
          >
            {copiedItem === id ? (
              <Check className="h-4 w-4 text-green-400" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            )}
          </button>
        </div>
        {isExpanded && hasDetails && (
          <div className="border-t border-zinc-800/50 bg-zinc-900/30 px-4 py-3 pl-12">
            {activity.permission && (
              <div className="mb-2 flex items-center gap-2 text-xs">
                <Shield className="h-3 w-3 text-yellow-400" aria-hidden="true" />
                <span className="text-zinc-400">Required permission:</span>
                <span className="font-mono text-zinc-300">{activity.permission}</span>
              </div>
            )}
            {activity.intentFilters.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-zinc-400">Intent Filters:</span>
                {activity.intentFilters.map((filter, i) => (
                  <div key={i} className="ml-2 flex flex-wrap gap-2 text-xs">
                    {filter.action && (
                      <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-zinc-300">
                        action: {filter.action}
                      </span>
                    )}
                    {filter.category && (
                      <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-zinc-300">
                        category: {filter.category}
                      </span>
                    )}
                    {filter.data && (
                      <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-zinc-300">
                        data: {filter.data}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render service item
  const renderService = (
    service: { name: string; exported: boolean; permission?: string },
    index: number
  ) => {
    const id = `service-${index}`;
    const hasDetails = !!service.permission;
    const isExpanded = expandedItems.has(id);

    return (
      <div key={id} className="transition-colors hover:bg-zinc-800/50">
        <div className="group flex items-center gap-3 px-4 py-3">
          {hasDetails ? (
            <button
              type="button"
              onClick={() => toggleExpanded(id)}
              className="flex-shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <Settings className="h-4 w-4 flex-shrink-0 text-orange-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm text-zinc-300" title={service.name}>
              {getShortName(service.name)}
            </span>
            <span className="block truncate text-xs text-zinc-500" title={service.name}>
              {service.name}
            </span>
          </div>
          <ExportedIndicator exported={service.exported} hasPermission={!!service.permission} />
          <button
            type="button"
            onClick={() => handleCopy(service.name, id)}
            aria-label={copiedItem === id ? "Copied" : `Copy service name`}
            className="flex-shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 focus:opacity-100"
          >
            {copiedItem === id ? (
              <Check className="h-4 w-4 text-green-400" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            )}
          </button>
        </div>
        {isExpanded && hasDetails && (
          <div className="border-t border-zinc-800/50 bg-zinc-900/30 px-4 py-3 pl-12">
            {service.permission && (
              <div className="flex items-center gap-2 text-xs">
                <Shield className="h-3 w-3 text-yellow-400" aria-hidden="true" />
                <span className="text-zinc-400">Required permission:</span>
                <span className="font-mono text-zinc-300">{service.permission}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render receiver item
  const renderReceiver = (
    receiver: { name: string; exported: boolean; intentFilters: Array<{ action?: string }> },
    index: number
  ) => {
    const id = `receiver-${index}`;
    const hasDetails = receiver.intentFilters.length > 0;
    const isExpanded = expandedItems.has(id);

    return (
      <div key={id} className="transition-colors hover:bg-zinc-800/50">
        <div className="group flex items-center gap-3 px-4 py-3">
          {hasDetails ? (
            <button
              type="button"
              onClick={() => toggleExpanded(id)}
              className="flex-shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <Radio className="h-4 w-4 flex-shrink-0 text-purple-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm text-zinc-300" title={receiver.name}>
              {getShortName(receiver.name)}
            </span>
            <span className="block truncate text-xs text-zinc-500" title={receiver.name}>
              {receiver.name}
            </span>
          </div>
          <ExportedIndicator exported={receiver.exported} hasPermission={false} />
          <button
            type="button"
            onClick={() => handleCopy(receiver.name, id)}
            aria-label={copiedItem === id ? "Copied" : `Copy receiver name`}
            className="flex-shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 focus:opacity-100"
          >
            {copiedItem === id ? (
              <Check className="h-4 w-4 text-green-400" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            )}
          </button>
        </div>
        {isExpanded && hasDetails && (
          <div className="border-t border-zinc-800/50 bg-zinc-900/30 px-4 py-3 pl-12">
            <div className="space-y-1">
              <span className="text-xs text-zinc-400">Intent Filters:</span>
              {receiver.intentFilters.map((filter, i) => (
                <div key={i} className="ml-2 text-xs">
                  {filter.action && (
                    <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-zinc-300">
                      action: {filter.action}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render provider item
  const renderProvider = (
    provider: { name: string; exported: boolean; authorities?: string; permission?: string },
    index: number
  ) => {
    const id = `provider-${index}`;
    const hasDetails = !!provider.authorities || !!provider.permission;
    const isExpanded = expandedItems.has(id);

    return (
      <div key={id} className="transition-colors hover:bg-zinc-800/50">
        <div className="group flex items-center gap-3 px-4 py-3">
          {hasDetails ? (
            <button
              type="button"
              onClick={() => toggleExpanded(id)}
              className="flex-shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <Database className="h-4 w-4 flex-shrink-0 text-cyan-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm text-zinc-300" title={provider.name}>
              {getShortName(provider.name)}
            </span>
            <span className="block truncate text-xs text-zinc-500" title={provider.name}>
              {provider.name}
            </span>
          </div>
          <ExportedIndicator exported={provider.exported} hasPermission={!!provider.permission} />
          <button
            type="button"
            onClick={() => handleCopy(provider.name, id)}
            aria-label={copiedItem === id ? "Copied" : `Copy provider name`}
            className="flex-shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 focus:opacity-100"
          >
            {copiedItem === id ? (
              <Check className="h-4 w-4 text-green-400" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            )}
          </button>
        </div>
        {isExpanded && hasDetails && (
          <div className="space-y-2 border-t border-zinc-800/50 bg-zinc-900/30 px-4 py-3 pl-12">
            {provider.authorities && (
              <div className="flex items-center gap-2 text-xs">
                <Database className="h-3 w-3 text-cyan-400" aria-hidden="true" />
                <span className="text-zinc-400">Authorities:</span>
                <span className="font-mono text-zinc-300">{provider.authorities}</span>
              </div>
            )}
            {provider.permission && (
              <div className="flex items-center gap-2 text-xs">
                <Shield className="h-3 w-3 text-yellow-400" aria-hidden="true" />
                <span className="text-zinc-400">Required permission:</span>
                <span className="font-mono text-zinc-300">{provider.permission}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render section with category header
  const renderSection = (
    title: string,
    icon: React.ReactNode,
    items: React.ReactNode[],
    show: boolean
  ) => {
    if (!show || items.length === 0) return null;

    return (
      <div className="border-b border-zinc-800 last:border-b-0">
        <div className="flex items-center gap-2 bg-zinc-800/30 px-4 py-2">
          {icon}
          <span className="text-sm font-medium text-zinc-300">{title}</span>
          <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
            {items.length}
          </span>
        </div>
        <div className="divide-y divide-zinc-800/50">{items}</div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* App Info Header */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-violet-400" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-medium text-zinc-100">
                {fileName ? `Manifest: ${fileName}` : "AndroidManifest.xml"}
              </h3>
              <p className="font-mono text-sm text-zinc-400">{manifest.package}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-400">
              Version <span className="font-medium text-zinc-100">{manifest.versionName}</span>
              <span className="text-zinc-500"> ({manifest.versionCode})</span>
            </span>
            <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-400">
              SDK <span className="font-medium text-zinc-100">{manifest.minSdk}</span>
              <span className="text-zinc-500"> - {manifest.targetSdk}</span>
            </span>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-zinc-800 pt-4 text-sm">
          <span className="text-zinc-400">
            <span className="font-medium text-zinc-100">{stats.permissionCount}</span> permissions
          </span>
          <span className="text-zinc-400">
            <span className="font-medium text-zinc-100">{stats.activityCount}</span> activities
          </span>
          <span className="text-zinc-400">
            <span className="font-medium text-zinc-100">{stats.serviceCount}</span> services
          </span>
          <span className="text-zinc-400">
            <span className="font-medium text-zinc-100">{stats.receiverCount}</span> receivers
          </span>
          <span className="text-zinc-400">
            <span className="font-medium text-zinc-100">{stats.providerCount}</span> providers
          </span>
        </div>
      </div>

      {/* Security Warnings Banner */}
      {(manifest.securityIssues.length > 0 || manifest.debuggable || manifest.allowBackup) && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
            <h4 className="font-medium text-red-400">Security Concerns</h4>
            <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-400">
              {manifest.securityIssues.length +
                (manifest.debuggable ? 1 : 0) +
                (manifest.allowBackup ? 1 : 0)}
            </span>
          </div>
          <div className="space-y-2">
            {manifest.debuggable && (
              <div className="flex items-start gap-2 rounded bg-red-900/20 p-2">
                <SeverityBadge severity="high" />
                <span className="text-sm text-red-300">
                  App is debuggable - allows debugging and code injection on any device
                </span>
              </div>
            )}
            {manifest.allowBackup && (
              <div className="flex items-start gap-2 rounded bg-yellow-900/20 p-2">
                <SeverityBadge severity="medium" />
                <span className="text-sm text-yellow-300">
                  Backup allowed - app data can be extracted via ADB backup
                </span>
              </div>
            )}
            {manifest.securityIssues.map((issue, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 rounded p-2 ${
                  issue.severity === "high"
                    ? "bg-red-900/20"
                    : issue.severity === "medium"
                      ? "bg-yellow-900/20"
                      : "bg-blue-900/20"
                }`}
              >
                <SeverityBadge severity={issue.severity} />
                <div className="flex-1">
                  <span
                    className={`text-sm ${
                      issue.severity === "high"
                        ? "text-red-300"
                        : issue.severity === "medium"
                          ? "text-yellow-300"
                          : "text-blue-300"
                    }`}
                  >
                    {issue.issue}
                  </span>
                  {issue.component && (
                    <span className="ml-2 font-mono text-xs text-zinc-500">
                      ({issue.component})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Manifest categories">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={category === cat.id}
            aria-controls="manifest-panel"
            onClick={() => handleCategoryChange(cat.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              category === cat.id
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                category === cat.id ? "bg-violet-500 text-white" : "bg-zinc-700 text-zinc-400"
              }`}
            >
              {cat.count.toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search
          className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500"
          aria-hidden="true"
        />
        <input
          type="text"
          id="manifest-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search components by name..."
          aria-label="Search manifest components"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2 pr-4 pl-10 text-sm text-zinc-100 placeholder-zinc-500 transition-colors focus:border-violet-500 focus:outline-none"
        />
      </div>

      {/* Results List */}
      <div
        id="manifest-panel"
        role="tabpanel"
        aria-label={`${category === "all" ? "All" : category} components`}
        className="rounded-lg border border-zinc-800 bg-zinc-900/50"
      >
        {totalFilteredCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="mb-3 h-8 w-8 text-zinc-600" aria-hidden="true" />
            <p className="text-sm text-zinc-400">No components found</p>
            {searchQuery && (
              <p className="mt-1 text-xs text-zinc-500">Try a different search term or category</p>
            )}
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {/* Permissions Section */}
            {renderSection(
              "Permissions",
              <Lock className="h-4 w-4 text-violet-400" aria-hidden="true" />,
              filteredPermissions.map((p, i) => renderPermission(p, i)),
              category === "all" || category === "permissions"
            )}

            {/* Activities Section */}
            {renderSection(
              "Activities",
              <FileCode className="h-4 w-4 text-blue-400" aria-hidden="true" />,
              filteredActivities.map((a, i) => renderActivity(a, i)),
              category === "all" || category === "activities"
            )}

            {/* Services Section */}
            {renderSection(
              "Services",
              <Settings className="h-4 w-4 text-orange-400" aria-hidden="true" />,
              filteredServices.map((s, i) => renderService(s, i)),
              category === "all" || category === "services"
            )}

            {/* Receivers Section */}
            {renderSection(
              "Receivers",
              <Radio className="h-4 w-4 text-purple-400" aria-hidden="true" />,
              filteredReceivers.map((r, i) => renderReceiver(r, i)),
              category === "all" || category === "receivers"
            )}

            {/* Providers Section */}
            {renderSection(
              "Providers",
              <Database className="h-4 w-4 text-cyan-400" aria-hidden="true" />,
              filteredProviders.map((p, i) => renderProvider(p, i)),
              category === "all" || category === "providers"
            )}
          </div>
        )}
      </div>

      {/* Results Count Footer */}
      {totalFilteredCount > 0 && (
        <p className="text-xs text-zinc-500">
          Showing {totalFilteredCount.toLocaleString()} components
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      )}
    </div>
  );
}
