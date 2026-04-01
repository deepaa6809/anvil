/**
 * Permission Enforcement Engine
 *
 * Evaluates tool permissions at runtime. Supports network, filesystem,
 * environment, subprocess, database, and custom permission types.
 */

import type { AnvilPermission, AnvilIRTool } from '@anvil-tools/schema';

export interface PermissionContext {
  /** Network requests made during tool execution */
  network?: { url: string; method: string };
  /** File paths accessed */
  filesystem?: { path: string; operation: 'read' | 'write' | 'delete' };
  /** Environment variables accessed */
  environment?: { variable: string };
  /** Subprocesses spawned */
  subprocess?: { command: string };
}

export interface PermissionCheckResult {
  allowed: boolean;
  violations: PermissionViolation[];
}

export interface PermissionViolation {
  type: string;
  target: string;
  reason: string;
  permission?: AnvilPermission;
}

/**
 * Check if a tool has permission for a given context.
 */
export function checkPermission(
  tool: AnvilIRTool,
  context: PermissionContext,
): PermissionCheckResult {
  const violations: PermissionViolation[] = [];

  if (context.network) {
    const networkPerms = tool.permissions.filter(p => p.type === 'network');
    if (networkPerms.length === 0) {
      violations.push({
        type: 'network',
        target: context.network.url,
        reason: `Tool "${tool.name}" has no network permissions but attempted to access ${context.network.url}`,
      });
    } else {
      const allowed = networkPerms.some(p => {
        const urlMatch = context.network!.url.includes(p.target);
        const methodMatch = !p.methods || p.methods.includes(context.network!.method.toUpperCase());
        return urlMatch && methodMatch;
      });
      if (!allowed) {
        violations.push({
          type: 'network',
          target: context.network.url,
          reason: `Network access to ${context.network.url} (${context.network.method}) not permitted for tool "${tool.name}"`,
        });
      }
    }
  }

  if (context.filesystem) {
    const fsPerms = tool.permissions.filter(p => p.type === 'filesystem');
    if (fsPerms.length === 0) {
      violations.push({
        type: 'filesystem',
        target: context.filesystem.path,
        reason: `Tool "${tool.name}" has no filesystem permissions but attempted to access ${context.filesystem.path}`,
      });
    } else {
      const allowed = fsPerms.some(p => {
        const pathMatch = matchGlob(context.filesystem!.path, p.target);
        const opMatch = !p.methods || p.methods.includes(context.filesystem!.operation);
        return pathMatch && opMatch;
      });
      if (!allowed) {
        violations.push({
          type: 'filesystem',
          target: context.filesystem.path,
          reason: `Filesystem access to ${context.filesystem.path} (${context.filesystem.operation}) not permitted for tool "${tool.name}"`,
        });
      }
    }
  }

  if (context.environment) {
    const envPerms = tool.permissions.filter(p => p.type === 'environment');
    const allowed = envPerms.some(p =>
      p.target === '*' || p.target === context.environment!.variable,
    );
    if (!allowed) {
      violations.push({
        type: 'environment',
        target: context.environment.variable,
        reason: `Access to env var ${context.environment.variable} not permitted for tool "${tool.name}"`,
      });
    }
  }

  if (context.subprocess) {
    const subPerms = tool.permissions.filter(p => p.type === 'subprocess');
    if (subPerms.length === 0) {
      violations.push({
        type: 'subprocess',
        target: context.subprocess.command,
        reason: `Tool "${tool.name}" has no subprocess permissions but attempted to run: ${context.subprocess.command}`,
      });
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
}

/**
 * Get a summary of all permissions required by a tool.
 */
export function getPermissionSummary(tool: AnvilIRTool): string[] {
  return tool.permissions.map(p => {
    const methods = p.methods ? ` (${p.methods.join(', ')})` : '';
    return `${p.type}: ${p.target}${methods}${p.reason ? ` — ${p.reason}` : ''}`;
  });
}

function matchGlob(path: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('/**')) {
    return path.startsWith(pattern.slice(0, -3));
  }
  if (pattern.endsWith('/*')) {
    const dir = pattern.slice(0, -2);
    return path.startsWith(dir) && !path.slice(dir.length + 1).includes('/');
  }
  return path === pattern || path.startsWith(pattern);
}
