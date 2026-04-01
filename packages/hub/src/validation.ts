/**
 * Hub API input validation via Zod.
 * Every mutation endpoint validates through these schemas.
 */

import { z } from 'zod';

export const publishSchema = z.object({
  definition: z.string()
    .min(10, 'Definition too short — must be a valid Anvil YAML')
    .max(2_000_000, 'Definition too large (max 2MB)'),
  readme: z.string().max(500_000).optional(),
  repository: z.string().url('Invalid repository URL').optional().or(z.literal('')),
  license: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
  author_email: z.string().email().optional().or(z.literal('')),
});

export const createTokenSchema = z.object({
  owner: z.string().min(1).max(100).default('user'),
  scopes: z.enum(['publish', 'admin']).default('publish'),
});

export const searchSchema = z.object({
  q: z.string().max(200).default(''),
  tags: z.string().max(500).default(''),
  sort: z.enum(['downloads', 'updated', 'created', 'name', 'featured']).default('downloads'),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Validate a parsed Anvil YAML definition.
 * Returns errors array (empty = valid).
 */
export function validateDefinition(yaml: string): string[] {
  const errors: string[] = [];

  if (!yaml.includes('anvil:')) {
    errors.push('Missing "anvil:" version field');
  }

  const nameMatch = yaml.match(/^\s+name:\s+(.+)$/m);
  if (!nameMatch) {
    errors.push('Missing service.name');
  } else {
    const name = nameMatch[1]!.trim().replace(/['"]/g, '');
    if (!/^[a-z][a-z0-9_-]*$/.test(name)) {
      errors.push(`Invalid service name "${name}" — must be lowercase with hyphens/underscores`);
    }
  }

  const versionMatch = yaml.match(/^\s+version:\s+"?([^"\s]+)"?$/m);
  if (!versionMatch) {
    errors.push('Missing service.version');
  } else {
    const version = versionMatch[1]!.trim();
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      errors.push(`Invalid version "${version}" — must be semver (x.y.z)`);
    }
  }

  if (!yaml.includes('\ntools:')) {
    errors.push('Missing tools section');
  } else {
    const toolsIdx = yaml.indexOf('\ntools:');
    const toolSection = yaml.slice(toolsIdx);
    const toolCount = (toolSection.match(/^  [a-z][a-z0-9_]*:\s*$/gm) ?? []).length;
    if (toolCount === 0) {
      errors.push('No tools defined — add at least one tool');
    }
  }

  return errors;
}
