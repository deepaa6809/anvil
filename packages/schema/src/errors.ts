/**
 * Anvil error types — structured diagnostics for the compiler pipeline.
 */

export type AnvilSeverity = 'error' | 'warning' | 'info';

export interface AnvilSourceLocation {
  file?: string;
  line?: number;
  column?: number;
  /** JSONPath-style path within the document (e.g. "tools.get_weather.parameters.location") */
  path?: string;
}

export interface AnvilDiagnostic {
  severity: AnvilSeverity;
  code: string;
  message: string;
  location?: AnvilSourceLocation;
  /** Suggested fix */
  hint?: string;
}

export class AnvilError extends Error {
  public readonly diagnostics: AnvilDiagnostic[];

  constructor(diagnostics: AnvilDiagnostic[]) {
    const errors = diagnostics.filter(d => d.severity === 'error');
    const message = errors.length === 1
      ? errors[0]!.message
      : `${errors.length} errors found in tool definition`;
    super(message);
    this.name = 'AnvilError';
    this.diagnostics = diagnostics;
  }

  format(): string {
    return this.diagnostics
      .map(d => {
        const loc = d.location;
        const prefix = d.severity === 'error' ? 'ERROR' : d.severity === 'warning' ? 'WARN' : 'INFO';
        const position = loc
          ? `${loc.file ?? '<input>'}${loc.line ? `:${loc.line}` : ''}${loc.column ? `:${loc.column}` : ''}`
          : '<input>';
        const path = loc?.path ? ` (at ${loc.path})` : '';
        const hint = d.hint ? `\n  hint: ${d.hint}` : '';
        return `${prefix} [${d.code}]: ${d.message}${path}\n  --> ${position}${hint}`;
      })
      .join('\n\n');
  }
}
