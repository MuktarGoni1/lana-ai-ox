#!/bin/bash
# Script to manage multiple git repositories with different GitHub accounts

# Function to add a new remote repository
add_remote_repo() {
    echo "Adding remote repository..."
    read -p "Enter remote name (e.g., personal, work): " remote_name
    read -p "Enter repository URL: " repo_url
    git remote add $remote_name $repo_url
    echo "Remote '$remote_name' added with URL: $repo_url"
}

# Function to push to a specific remote
push_to_remote() {
    echo "Current remotes:"
    git remote -v
    
    read -p "Enter remote name to push to: " remote_name
    read -p "Enter branch name (default: main): " branch_name
    
    if [ -z "$branch_name" ]; then
        branch_name="main"
    fi
    
    echo "Pushing to $remote_name/$branch_name..."
    git push $remote_name $branch_name
}

# Function to list all remotes
list_remotes() {
    echo "Current remotes:"
    git remote -v
}

# Function to show help
show_help() {
    echo "Usage:"
    echo "  ./manage-repos.sh add      - Add a new remote repository"
    echo "  ./manage-repos.sh push    - Push to a specific remote"
    echo "  ./manage-repos.sh list    - List all remotes"
    echo "  ./manage-repos.sh help    - Show this help"
}

# Main script logic
case "$1" in
    "add")
        add_remote_repo
        ;;
    "push")
        push_to_remote
        ;;
    "list")
        list_remotes
        ;;
    "help"|*)
        show_help
        ;;
esac