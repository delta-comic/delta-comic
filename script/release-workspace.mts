import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { rootDir } from './set-version.mts'

type DependencyBlock = Record<string, string>

interface WorkspaceManifest {
  dependencies?: DependencyBlock
  devDependencies?: DependencyBlock
  name?: string
  optionalDependencies?: DependencyBlock
  peerDependencies?: DependencyBlock
  private?: boolean
  publishConfig?: { access?: string }
  scripts?: Record<string, string>
  version?: string
}

export interface PublishableWorkspacePackage {
  dependencies: string[]
  name: string
  path: string
  version: string
}

interface LoadedWorkspacePackage {
  manifest: WorkspaceManifest
  path: string
}

function workspaceDependencies(manifest: WorkspaceManifest) {
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]
}

function sortByWorkspaceDependencies(packages: PublishableWorkspacePackage[]) {
  const packagesByName = new Map(packages.map(pkg => [pkg.name, pkg]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const result: PublishableWorkspacePackage[] = []

  const visit = (pkg: PublishableWorkspacePackage) => {
    if (visited.has(pkg.name)) return
    if (visiting.has(pkg.name)) {
      throw new Error(`Circular dependency detected between publishable packages at ${pkg.name}`)
    }

    visiting.add(pkg.name)
    for (const dependencyName of pkg.dependencies.toSorted()) {
      const dependency = packagesByName.get(dependencyName)
      if (dependency) visit(dependency)
    }
    visiting.delete(pkg.name)
    visited.add(pkg.name)
    result.push(pkg)
  }

  for (const pkg of packages) visit(pkg)
  return result
}

export class ReleaseWorkspace {
  private readonly cwd: string

  constructor(cwd = rootDir) {
    this.cwd = cwd
  }

  private async loadPackages() {
    const packagesDir = join(this.cwd, 'packages')
    const entries = await readdir(packagesDir, { withFileTypes: true })
    const packages: LoadedWorkspacePackage[] = []

    for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory()) continue
      const manifestPath = join(packagesDir, entry.name, 'package.json')
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as WorkspaceManifest
      packages.push({ manifest, path: relative(this.cwd, manifestPath) })
    }

    return packages
  }

  async publishablePackages() {
    const workspacePackages = await this.loadPackages()
    const workspacePackagesByName = new Map(
      workspacePackages.flatMap(pkg =>
        typeof pkg.manifest.name === 'string' ? [[pkg.manifest.name, pkg] as const] : [],
      ),
    )
    const publishablePackages: PublishableWorkspacePackage[] = []

    for (const pkg of workspacePackages) {
      const { manifest, path } = pkg
      if (manifest.private === true) continue
      if (typeof manifest.name !== 'string' || !manifest.name) {
        throw new Error(`Publishable workspace manifest ${path} must declare a package name`)
      }
      if (typeof manifest.version !== 'string' || !manifest.version) {
        throw new Error(`Publishable package ${manifest.name} must declare a version`)
      }
      if (typeof manifest.scripts?.build !== 'string') {
        throw new Error(`Publishable package ${manifest.name} must declare a build script`)
      }
      if (manifest.publishConfig?.access !== 'public') {
        throw new Error(
          `Publishable package ${manifest.name} must set publishConfig.access to public`,
        )
      }

      const dependencies = workspaceDependencies(manifest)
      for (const dependencyName of dependencies) {
        const dependency = workspacePackagesByName.get(dependencyName)
        if (dependency?.manifest.private === true) {
          throw new Error(
            `Publishable package ${manifest.name} cannot depend on private workspace package ${dependencyName}`,
          )
        }
      }

      publishablePackages.push({
        dependencies,
        name: manifest.name,
        path,
        version: manifest.version,
      })
    }

    if (publishablePackages.length === 0) {
      throw new Error('No publishable workspace packages were found')
    }

    return sortByWorkspaceDependencies(publishablePackages)
  }
}

export function assertWorkspaceVersion(
  packages: PublishableWorkspacePackage[],
  expectedVersion: string,
) {
  const mismatches = packages.filter(pkg => pkg.version !== expectedVersion)
  if (mismatches.length === 0) return

  throw new Error(
    `Publishable workspace versions must equal ${expectedVersion}: ${mismatches
      .map(pkg => `${pkg.name}@${pkg.version}`)
      .join(', ')}`,
  )
}