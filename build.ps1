# Script to build the application while ignoring Supabase Edge Functions
Write-Host "HeaWaBas - Starting build process" -ForegroundColor Green

# Create backup directory
if (-not (Test-Path -Path ".supabase-backup")) {
    Write-Host "Creating backup directory for Edge Functions..." -ForegroundColor Yellow
    New-Item -Path ".supabase-backup" -ItemType Directory -Force
}

# Copy and temporarily remove Supabase functions
if (Test-Path -Path "supabase/functions") {
    Write-Host "Copying Supabase functions to backup directory..." -ForegroundColor Yellow
    Copy-Item -Path "supabase/functions" -Destination ".supabase-backup/" -Recurse -Force
    Write-Host "Temporarily removing Supabase functions..." -ForegroundColor Yellow
    Remove-Item -Path "supabase/functions" -Recurse -Force
}

# Execute build process
Write-Host "Starting build process..." -ForegroundColor Cyan
npm run build
$buildStatus = $LASTEXITCODE

# Restore Supabase functions
if (Test-Path -Path ".supabase-backup/functions") {
    Write-Host "Restoring Supabase functions..." -ForegroundColor Yellow
    # Ensure directory exists
    if (-not (Test-Path -Path "supabase")) {
        New-Item -Path "supabase" -ItemType Directory -Force
    }
    Copy-Item -Path ".supabase-backup/functions" -Destination "supabase/" -Recurse -Force
}

# Show result
if ($buildStatus -eq 0) {
    Write-Host "Build completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Build failed!" -ForegroundColor Red
}

Write-Host "Process completed" -ForegroundColor Green 