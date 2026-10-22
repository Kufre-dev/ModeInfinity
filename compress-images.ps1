# ============================================================================
# ModeInfinity — Batch image compression
# Run from project root:  .\compress-images.ps1
# Backup already at assets\_originals\ — safe to overwrite in place.
# ============================================================================

$ErrorActionPreference = "Stop"
$root = "assets\images"

$script:Before = 0
$script:After = 0
$script:Count = 0

# ---- Per-file target resolution ------------------------------------------
function Get-Target {
  param([string]$RelPath, [string]$BaseName)

  # Full-bleed hero backgrounds
  if ($BaseName -match "golden_hour_atelier|luxury_shoemaking_atelier") {
    return @{ MaxW = 1920; JpgQ = 78; WebpQ = 72; AvifQ = 58 }
  }
  # Small avatars (testimonials)
  if ($RelPath -match "testimonial") {
    return @{ MaxW = 400; JpgQ = 82; WebpQ = 78; AvifQ = 65 }
  }
  # Founder portrait (hero visual)
  if ($BaseName -match "profile picture") {
    return @{ MaxW = 900; JpgQ = 82; WebpQ = 78; AvifQ = 65 }
  }
  # Product cards
  if ($RelPath -match "\\shoes\\" -or $BaseName -match "^shoe\d+$|^shoe-gallery\d+$") {
    return @{ MaxW = 1200; JpgQ = 80; WebpQ = 75; AvifQ = 60 }
  }
  # Portfolio / student showcase — displayed larger
  if ($RelPath -match "student showcase") {
    return @{ MaxW = 1600; JpgQ = 78; WebpQ = 72; AvifQ = 58 }
  }
  # Everything else: academy pillars, workshop, craft, about
  return @{ MaxW = 1400; JpgQ = 78; WebpQ = 72; AvifQ = 58 }
}

# ---- Process one image set (jpg + webp + avif variants) ------------------
function Compress-Set {
  param([string]$BasePath, [hashtable]$Target)

  # Find a "source" — prefer JPG/JPEG; fall back to WebP then AVIF
  $source = $null
  foreach ($ext in @(".jpg", ".jpeg", ".webp", ".avif")) {
    if (Test-Path "$BasePath$ext") { $source = "$BasePath$ext"; break }
  }
  if (-not $source) { return }

  # Encode every variant that already exists
  $variants = @()
  if (Test-Path "$BasePath.jpg") { $variants += @{ P = "$BasePath.jpg"; Q = $Target.JpgQ } }
  if (Test-Path "$BasePath.jpeg") { $variants += @{ P = "$BasePath.jpeg"; Q = $Target.JpgQ } }
  if (Test-Path "$BasePath.webp") { $variants += @{ P = "$BasePath.webp"; Q = $Target.WebpQ } }
  if (Test-Path "$BasePath.avif") { $variants += @{ P = "$BasePath.avif"; Q = $Target.AvifQ } }

  foreach ($v in $variants) {
    $before = (Get-Item $v.P).Length
    $tmp = "$($v.P).tmp"

    & magick "$source" `
      -resize "$($Target.MaxW)x>" `
      -strip `
      -quality $($v.Q) `
      "$tmp"

    if (Test-Path $tmp) {
      Move-Item -Force $tmp $v.P
      $after = (Get-Item $v.P).Length
      $script:Before += $before
      $script:After += $after
      $script:Count++

      $bKB = [math]::Round($before / 1KB, 1)
      $aKB = [math]::Round($after / 1KB, 1)
      $sav = [math]::Round(($before - $after) / 1KB, 1)

      $leaf = [System.IO.Path]::GetFileName($v.P)
      Write-Host ("  {0,-55} {1,7} -> {2,7} KB  (-{3} KB)" -f $leaf, $bKB, $aKB, $sav)
    }
    else {
      Write-Host "  FAILED: $($v.P)" -ForegroundColor Red
    }
  }
}

# ---- Walk the tree -------------------------------------------------------
Write-Host ""
Write-Host "Compressing images under $root" -ForegroundColor Cyan
Write-Host ""

# Group by base name (path without extension) so we process each set once
$sets = @{}
Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $_.Extension -match "\.(jpg|jpeg|webp|avif)$"
} | ForEach-Object {
  $base = $_.FullName -replace "\.(jpg|jpeg|webp|avif)$", ""
  $sets[$base] = $true
}

foreach ($base in $sets.Keys) {
  $rel = $base.Replace("$PWD\", "")
  $name = [System.IO.Path]::GetFileNameWithoutExtension($base)
  $target = Get-Target -RelPath $rel -BaseName $name

  Write-Host "[$([System.IO.Path]::GetFileName($base))]" -ForegroundColor Yellow
  Compress-Set -BasePath $base -Target $target
}

# ---- Summary -------------------------------------------------------------
$bMB = [math]::Round($script:Before / 1MB, 2)
$aMB = [math]::Round($script:After / 1MB, 2)
$sMB = [math]::Round(($script:Before - $script:After) / 1MB, 2)

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  Files processed : $($script:Count)"           -ForegroundColor Green
Write-Host "  Before          : $bMB MB"
Write-Host "  After           : $aMB MB"
Write-Host "  Saved           : $sMB MB"
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""