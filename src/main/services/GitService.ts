import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export type GitChange = {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  isStaged: boolean;
};

export type GitCommit = {
  hash: string;
  author: string;
  date: string;
  message: string;
};

export type GitRemoteStatus = {
  ahead: number;
  behind: number;
  hasNewCommits: boolean;
  currentBranch: string;
  remoteBranch: string;
};

export async function getStatus(workspacePath: string): Promise<GitChange[]> {
  // Return empty if not a git repo
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: workspacePath,
    });
  } catch {
    return [];
  }

  const { stdout: statusOutput } = await execFileAsync('git', ['status', '--porcelain'], {
    cwd: workspacePath,
  });

  if (!statusOutput.trim()) return [];

  const changes: GitChange[] = [];
  const statusLines = statusOutput
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.length > 0);

  for (const line of statusLines) {
    const statusCode = line.substring(0, 2);
    let filePath = line.substring(3);
    if (statusCode.includes('R') && filePath.includes('->')) {
      const parts = filePath.split('->');
      filePath = parts[parts.length - 1].trim();
    }

    let status = 'modified';
    if (statusCode.includes('A') || statusCode.includes('?')) status = 'added';
    else if (statusCode.includes('D')) status = 'deleted';
    else if (statusCode.includes('R')) status = 'renamed';
    else if (statusCode.includes('M')) status = 'modified';

    // Check if file is staged (first character of status code indicates staged changes)
    const isStaged = statusCode[0] !== ' ' && statusCode[0] !== '?';

    if (filePath.endsWith('codex-stream.log')) continue;

    let additions = 0;
    let deletions = 0;

    const sumNumstat = (stdout: string) => {
      const lines = stdout
        .trim()
        .split('\n')
        .filter((l) => l.trim().length > 0);
      for (const l of lines) {
        const p = l.split('\t');
        if (p.length >= 2) {
          const addStr = p[0];
          const delStr = p[1];
          const a = addStr === '-' ? 0 : parseInt(addStr, 10) || 0;
          const d = delStr === '-' ? 0 : parseInt(delStr, 10) || 0;
          additions += a;
          deletions += d;
        }
      }
    };

    try {
      const staged = await execFileAsync('git', ['diff', '--numstat', '--cached', '--', filePath], {
        cwd: workspacePath,
      });
      if (staged.stdout && staged.stdout.trim()) sumNumstat(staged.stdout);
    } catch {}

    try {
      const unstaged = await execFileAsync('git', ['diff', '--numstat', '--', filePath], {
        cwd: workspacePath,
      });
      if (unstaged.stdout && unstaged.stdout.trim()) sumNumstat(unstaged.stdout);
    } catch {}

    if (additions === 0 && deletions === 0 && statusCode.includes('?')) {
      const absPath = path.join(workspacePath, filePath);
      try {
        const stat = fs.existsSync(absPath) ? fs.statSync(absPath) : undefined;
        if (stat && stat.isFile()) {
          const buf = fs.readFileSync(absPath);
          let count = 0;
          for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) count++;
          additions = count;
        }
      } catch {}
    }

    changes.push({ path: filePath, status, additions, deletions, isStaged });
  }

  return changes;
}

export async function stageFile(workspacePath: string, filePath: string): Promise<void> {
  await execFileAsync('git', ['add', '--', filePath], { cwd: workspacePath });
}

export async function revertFile(
  workspacePath: string,
  filePath: string
): Promise<{ action: 'unstaged' | 'reverted' }> {
  // Check if file is staged
  try {
    const { stdout: stagedStatus } = await execFileAsync(
      'git',
      ['diff', '--cached', '--name-only', '--', filePath],
      {
        cwd: workspacePath,
      }
    );

    if (stagedStatus.trim()) {
      // File is staged, unstage it (but keep working directory changes)
      await execFileAsync('git', ['reset', 'HEAD', '--', filePath], { cwd: workspacePath });
      return { action: 'unstaged' };
    }
  } catch {
    // Ignore errors, continue with checkout
  }

  // File is not staged, revert working directory changes
  await execFileAsync('git', ['checkout', 'HEAD', '--', filePath], { cwd: workspacePath });
  return { action: 'reverted' };
}

export async function getFileDiff(
  workspacePath: string,
  filePath: string
): Promise<{ lines: Array<{ left?: string; right?: string; type: 'context' | 'add' | 'del' }> }> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--no-color', '--unified=2000', 'HEAD', '--', filePath],
      { cwd: workspacePath }
    );

    const linesRaw = stdout.split('\n');
    const result: Array<{ left?: string; right?: string; type: 'context' | 'add' | 'del' }> = [];
    for (const line of linesRaw) {
      if (!line) continue;
      if (
        line.startsWith('diff ') ||
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ') ||
        line.startsWith('@@')
      )
        continue;
      const prefix = line[0];
      const content = line.slice(1);
      if (prefix === ' ') result.push({ left: content, right: content, type: 'context' });
      else if (prefix === '-') result.push({ left: content, type: 'del' });
      else if (prefix === '+') result.push({ right: content, type: 'add' });
      else result.push({ left: line, right: line, type: 'context' });
    }

    if (result.length === 0) {
      try {
        const abs = path.join(workspacePath, filePath);
        if (fs.existsSync(abs)) {
          const content = fs.readFileSync(abs, 'utf8');
          return { lines: content.split('\n').map((l) => ({ right: l, type: 'add' as const })) };
        } else {
          const { stdout: prev } = await execFileAsync('git', ['show', `HEAD:${filePath}`], {
            cwd: workspacePath,
          });
          return { lines: prev.split('\n').map((l) => ({ left: l, type: 'del' as const })) };
        }
      } catch {
        return { lines: [] };
      }
    }

    return { lines: result };
  } catch {
    try {
      const abs = path.join(workspacePath, filePath);
      const content = fs.readFileSync(abs, 'utf8');
      const lines = content.split('\n');
      return { lines: lines.map((l) => ({ right: l, type: 'add' as const })) };
    } catch {
      try {
        const { stdout } = await execFileAsync(
          'git',
          ['diff', '--no-color', '--unified=2000', 'HEAD', '--', filePath],
          { cwd: workspacePath }
        );
        const linesRaw = stdout.split('\n');
        const result: Array<{ left?: string; right?: string; type: 'context' | 'add' | 'del' }> =
          [];
        for (const line of linesRaw) {
          if (!line) continue;
          if (
            line.startsWith('diff ') ||
            line.startsWith('index ') ||
            line.startsWith('--- ') ||
            line.startsWith('+++ ') ||
            line.startsWith('@@')
          )
            continue;
          const prefix = line[0];
          const content = line.slice(1);
          if (prefix === ' ') result.push({ left: content, right: content, type: 'context' });
          else if (prefix === '-') result.push({ left: content, type: 'del' });
          else if (prefix === '+') result.push({ right: content, type: 'add' });
          else result.push({ left: line, right: line, type: 'context' });
        }
        if (result.length === 0) {
          try {
            const { stdout: prev } = await execFileAsync('git', ['show', `HEAD:${filePath}`], {
              cwd: workspacePath,
            });
            return { lines: prev.split('\n').map((l) => ({ left: l, type: 'del' as const })) };
          } catch {
            return { lines: [] };
          }
        }
        return { lines: result };
      } catch {
        return { lines: [] };
      }
    }
  }
}

// New functions for git pull and remote status

export async function fetchFromRemote(workspacePath: string): Promise<void> {
  try {
    await execFileAsync('git', ['fetch', 'origin'], { cwd: workspacePath });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error('Git is not installed or not found in PATH. Please install Git and restart the application.');
    }
    throw error;
  }
}

export async function pullFromRemote(workspacePath: string): Promise<{ success: boolean; message: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', ['pull', 'origin'], { cwd: workspacePath });
    return {
      success: true,
      message: `Pull successful: ${stdout || stderr}`
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return {
        success: false,
        message: 'Git is not installed or not found in PATH. Please install Git and restart the application.'
      };
    }
    return {
      success: false,
      message: `Pull failed: ${error.message}`
    };
  }
}

export async function getCurrentBranch(workspacePath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: workspacePath
    });
    return stdout.trim();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return 'Git not installed';
    }
    return 'unknown';
  }
}

export async function getRemoteStatus(workspacePath: string): Promise<GitRemoteStatus | null> {
  try {
    // First fetch to get latest remote info
    await fetchFromRemote(workspacePath);

    const currentBranch = await getCurrentBranch(workspacePath);

    // If git is not installed, return null
    if (currentBranch === 'Git not installed') {
      return null;
    }

    // Get ahead/behind info
    const { stdout } = await execFileAsync('git', ['rev-list', '--count', '--left-right',
      `${currentBranch}...origin/${currentBranch}`], { cwd: workspacePath });

    const [behind, ahead] = stdout.trim().split('\t').map(Number);

    // Get tracking branch
    let remoteBranch = `origin/${currentBranch}`;
    try {
      const { stdout: trackingBranch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref',
        `${currentBranch}@{u}`], { cwd: workspacePath });
      remoteBranch = trackingBranch.trim();
    } catch {
      // Branch might not have tracking configured
    }

    return {
      ahead: ahead || 0,
      behind: behind || 0,
      hasNewCommits: (behind || 0) > 0,
      currentBranch,
      remoteBranch
    };
  } catch (error: any) {
    console.error('Failed to get remote status:', error);
    if (error.code === 'ENOENT') {
      console.error('Git is not installed or not found in PATH');
    }
    return null;
  }
}

export async function getCommitHistory(workspacePath: string, limit: number = 10): Promise<GitCommit[]> {
  try {
    const { stdout } = await execFileAsync('git', ['log',
      `--pretty=format:%H|%an|%ad|%s`,
      '--date=short',
      `-${limit}`
    ], { cwd: workspacePath });

    const commits: GitCommit[] = [];
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      const [hash, author, date, ...messageParts] = line.split('|');
      commits.push({
        hash: hash.substring(0, 8), // Short hash
        author,
        date,
        message: messageParts.join('|')
      });
    }

    return commits;
  } catch (error) {
    console.error('Failed to get commit history:', error);
    return [];
  }
}

export async function hasUncommittedChanges(workspacePath: string): Promise<boolean> {
  try {
    const changes = await getStatus(workspacePath);
    return changes.length > 0;
  } catch {
    return false;
  }
}
