type BuildEnvironment = Record<string, string | undefined>

const fullGitRevision = /^[0-9a-f]{40}$/

export function validatedBuildRevision(value: unknown): string | null {
  return typeof value === 'string' && fullGitRevision.test(value) ? value : null
}

/** Pick one source explicitly; invalid overrides must not gain a fallback identity. */
export function selectBuildRevision(environment: BuildEnvironment): string | null {
  for (const name of ['QAREVO_BUILD_REVISION', 'VERCEL_GIT_COMMIT_SHA', 'GITHUB_SHA']) {
    if (environment[name] !== undefined) return validatedBuildRevision(environment[name])
  }
  return null
}

/** Process liveness is separate from API, database and clinical readiness. */
export function frontendLiveness(revision: unknown) {
  return {
    status: 'alive' as const,
    scope: 'frontend_liveness' as const,
    revision: validatedBuildRevision(revision),
  }
}
