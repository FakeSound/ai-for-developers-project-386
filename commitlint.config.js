/**
 * Проверка сообщений коммитов по Conventional Commits.
 *
 * Соглашение целиком описано в CONTRIBUTING.md — здесь только его машинная
 * часть. Правила действуют в трёх местах: локальный хук `.husky/commit-msg`,
 * джоба `commitlint` для коммитов PR и проверка заголовка PR в CI.
 *
 * Мёрдж- и revert-коммиты commitlint пропускает сам (defaultIgnores).
 */

/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "scope-enum": [
      2,
      "always",
      [
        "contract",
        "backend",
        "frontend",
        "e2e",
        "ci",
        "docs",
        "deps",
        // release-please называет свой PR `chore(main): release X.Y.Z` —
        // без этого скоупа проверка заголовка роняла бы релизный PR.
        "main",
      ],
    ],
    // Скоуп необязателен, но если он есть — только из списка выше.
    "scope-empty": [0],
    // Правило рассчитано на латиницу и на русских заголовках работает наугад.
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
    // Тело коммита на русском переносится по 100 символов, как и заголовок.
    "body-max-line-length": [2, "always", 100],
    // Трейлеры вроде Co-Authored-By длиннее лимита — их не режем.
    "footer-max-line-length": [0],
  },
};
