import type { UserConfig } from "@commitlint/types";

// Conventional Commits: https://www.conventionalcommits.org
// Format: <type>(<optional scope>): <subject>
// Types: build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test
const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
};

export default config;
