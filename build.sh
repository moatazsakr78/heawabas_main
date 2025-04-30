#!/bin/bash
# Script to build the application while ignoring Supabase Edge Functions

echo -e "\033[0;32mHeaWaBas - Starting build process\033[0m"

# Create backup directory
if [ ! -d ".supabase-backup" ]; then
    echo -e "\033[0;33mCreating backup directory for Edge Functions...\033[0m"
    mkdir -p .supabase-backup
fi

# Copy and temporarily remove Supabase functions
if [ -d "supabase/functions" ]; then
    echo -e "\033[0;33mCopying Supabase functions to backup directory...\033[0m"
    cp -r supabase/functions .supabase-backup/
    echo -e "\033[0;33mTemporarily removing Supabase functions...\033[0m"
    rm -rf supabase/functions
fi

# Execute build process
echo -e "\033[0;36mStarting build process...\033[0m"
npm run build
BUILD_STATUS=$?

# Restore Supabase functions
if [ -d ".supabase-backup/functions" ]; then
    echo -e "\033[0;33mRestoring Supabase functions...\033[0m"
    # Ensure directory exists
    if [ ! -d "supabase" ]; then
        mkdir -p supabase
    fi
    cp -r .supabase-backup/functions supabase/
fi

# Show result
if [ $BUILD_STATUS -eq 0 ]; then
    echo -e "\033[0;32mBuild completed successfully!\033[0m"
else
    echo -e "\033[0;31mBuild failed!\033[0m"
fi

echo -e "\033[0;32mProcess completed\033[0m" 