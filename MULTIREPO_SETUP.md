# Multi-Repository Setup Guide

This document explains how to work with multiple GitHub repositories with different accounts.

## Setting Up Multiple Repositories

### Method 1: Using Different Remotes

You can add multiple remote repositories to push your changes to different accounts:

```bash
# Add an additional remote (e.g., for a different GitHub account)
git remote add personal https://github.com/your-personal-account/lana-ai-ox.git
git remote add work https://github.com/your-work-account/lana-ai-ox.git

# Push to specific remotes
git push personal main
git push work main
```

### Method 2: Using Git Configuration per Repository

To ensure you're using the right credentials:

```bash
# Set user info for this repository specifically
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### Method 3: Using SSH Keys for Different Accounts

For more secure authentication with different accounts:

1. Generate separate SSH keys for each account
2. Configure your SSH config file (`~/.ssh/config`)
3. Add the SSH keys to respective GitHub accounts

Example SSH config:
```
# Personal GitHub account
Host github.com-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_personal

# Work GitHub account
Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_work
```

Then clone repositories using the configured hosts:
```bash
git clone git@github.com-personal:username/repo.git
git clone git@github.com-work:username/repo.git
```

## Using the Management Scripts

We've provided helper scripts to manage multiple repositories:

### On Windows (PowerShell):
```powershell
# List all remotes
.\manage-repos.ps1 -Action List

# Add a new remote
.\manage-repos.ps1 -Action Add

# Push to a specific remote
.\manage-repos.ps1 -Action Push
```

## Best Practices

1. **Always pull before pushing**: Ensure you have the latest changes
   ```bash
   git pull origin main
   ```

2. **Check your remotes**: Make sure you're pushing to the right repository
   ```bash
   git remote -v
   ```

3. **Verify your identity**: Check that your git user info is correct
   ```bash
   git config user.name
   git config user.email
   ```

4. **Use feature branches**: When working with multiple repositories, use branches to isolate changes
   ```bash
   git checkout -b feature/new-feature
   git push origin feature/new-feature
   ```

## Current Repository Status

You currently have the following remotes configured:
```bash
git remote -v
```

## Troubleshooting

### If you get "Updates were rejected" error:
```bash
git pull --rebase origin main
# Resolve any conflicts
git push origin main
```

### If you accidentally commit to the wrong branch:
```bash
git reset --hard HEAD~1  # Undo the last commit
# Or move the commit to the correct branch
git checkout correct-branch
git cherry-pick <commit-hash>
```

### If you need to remove a remote:
```bash
git remote remove <remote-name>
```