# Conventional Commits Guide

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages.

## Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

- **feat**: A new feature for the user
- **fix**: A bug fix for the user
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

## Scopes

Common scopes in this project:
- **api**: Changes to the API package
- **admin**: Changes to the admin dashboard
- **sdk**: Changes to the mobile SDK
- **db**: Changes to the database package
- **ui**: Changes to the UI components package
- **infra**: Changes to infrastructure or deployment
- **docs**: Changes to documentation

## Examples

```bash
# Feature
feat(api): add user authentication endpoint
feat(admin): implement product management interface

# Bug fix
fix(sdk): resolve barcode scanner crash on Android

# Breaking change
feat(api)!: change authentication to use JWT tokens

BREAKING CHANGE: Authentication now requires JWT tokens instead of session cookies.
Existing clients must be updated to use the new authentication flow.

# Documentation
docs: update API documentation for authentication endpoints

# Chore
chore(deps): update fastify to version 4.24.3
```

## Release Impact

Commits trigger automatic releases:
- **fix**: Patch release (0.0.1)
- **feat**: Minor release (0.1.0)  
- **BREAKING CHANGE**: Major release (1.0.0)
- **docs**, **style**, **test**, **build**, **ci**, **chore**: No release

## Tools

- Use `git commit` with conventional format
- Consider using [Commitizen](https://github.com/commitizen/cz-cli) for guided commits
- Husky can enforce commit message format (to be added later)