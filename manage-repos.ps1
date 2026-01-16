# PowerShell script to manage multiple git repositories with different GitHub accounts

function Add-RemoteRepo {
    Write-Host "Adding remote repository..."
    $remoteName = Read-Host "Enter remote name (e.g., personal, work)"
    $repoUrl = Read-Host "Enter repository URL"
    git remote add $remoteName $repoUrl
    Write-Host "Remote '$remoteName' added with URL: $repoUrl"
}

function Push-ToRemote {
    Write-Host "Current remotes:"
    git remote -v
    $remoteName = Read-Host "Enter remote name to push to"
    $branchName = Read-Host "Enter branch name (default: main)"
    
    if ([string]::IsNullOrEmpty($branchName)) {
        $branchName = "main"
    }
    
    Write-Host "Pushing to $remoteName/$branchName..."
    git push $remoteName $branchName
}

function List-Remotes {
    Write-Host "Current remotes:"
    git remote -v
}

function Show-Help {
    Write-Host "Usage:"
    Write-Host "  .\manage-repos.ps1 -Action Add      - Add a new remote repository"
    Write-Host "  .\manage-repos.ps1 -Action Push    - Push to a specific remote"
    Write-Host "  .\manage-repos.ps1 -Action List    - List all remotes"
    Write-Host "  .\manage-repos.ps1 -Action Help    - Show this help"
}

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("Add", "Push", "List", "Help")]
    [string]$Action = "Help"
)

switch ($Action) {
    "Add" { Add-RemoteRepo }
    "Push" { Push-ToRemote }
    "List" { List-Remotes }
    "Help" { Show-Help }
}