# Regenerates favicon.ico, apple-touch-icon.png and manifest PNGs from the
# Kapital logo geometry (assets/logo.svg). Run: powershell -File tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot

function New-KapitalIcon([int]$size) {
  $f = $size / 64.0
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $black = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
  $chrome = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(192, 192, 192))
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $gray = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(128, 128, 128))
  $navy = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 0, 128))
  $navyDark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 0, 64))
  $navyLight = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(64, 64, 160))

  $g.FillRectangle($black, 0, 0, $size, $size)
  $g.FillRectangle($chrome, $f, $f, 62 * $f, 62 * $f)
  $g.FillRectangle($white, $f, $f, 62 * $f, 2 * $f)
  $g.FillRectangle($white, $f, $f, 2 * $f, 62 * $f)
  $g.FillRectangle($gray, $f, 61 * $f, 62 * $f, 2 * $f)
  $g.FillRectangle($gray, 61 * $f, $f, 2 * $f, 62 * $f)
  $g.FillRectangle($navy, 4 * $f, 4 * $f, 56 * $f, 56 * $f)
  $g.FillRectangle($navyDark, 4 * $f, 4 * $f, 56 * $f, $f)
  $g.FillRectangle($navyDark, 4 * $f, 4 * $f, $f, 56 * $f)
  $g.FillRectangle($navyLight, 4 * $f, 59 * $f, 56 * $f, $f)
  $g.FillRectangle($navyLight, 59 * $f, 4 * $f, $f, 56 * $f)

  $whitePen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 8 * $f)
  $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Flat
  $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Flat

  $g.DrawLine($whitePen, 20 * $f, 15 * $f, 20 * $f, 49 * $f)
  $g.DrawLine($whitePen, 25 * $f, 33 * $f, 43 * $f, 49 * $f)

  $green = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 176, 0))
  $arrowCoords = @(
    27.83, 33.83, 44.33, 18.33, 45.39, 19.39, 50, 7,
    37.61, 11.61, 38.67, 12.67, 22.17, 28.17
  )
  $arrow = @()
  for ($i = 0; $i -lt $arrowCoords.Count; $i += 2) {
    $arrow += [System.Drawing.PointF]::new($arrowCoords[$i] * $f, $arrowCoords[$i + 1] * $f)
  }
  $g.FillPolygon($green, $arrow)

  $g.Dispose()
  return $bmp
}

function Get-PngBytes([System.Drawing.Bitmap]$bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  return $ms.ToArray()
}

$sizes = 16, 32, 48
$pngs = New-Object 'System.Collections.Generic.List[byte[]]'
foreach ($s in $sizes) {
  $bmp = New-KapitalIcon $s
  [byte[]]$bytes = Get-PngBytes $bmp
  $pngs.Add($bytes)
  $bmp.Dispose()
}

$icoPath = Join-Path $root 'favicon.ico'
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$sizes.Count)
$offset = 6 + (16 * $sizes.Count)
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]
  $bw.Write([Byte]$s)
  $bw.Write([Byte]$s)
  $bw.Write([Byte]0)
  $bw.Write([Byte]0)
  $bw.Write([UInt16]1)
  $bw.Write([UInt16]32)
  $bw.Write([UInt32]$pngs[$i].Length)
  $bw.Write([UInt32]$offset)
  $offset += $pngs[$i].Length
}
foreach ($bytes in $pngs) { $bw.Write([byte[]]$bytes) }
$bw.Flush()
$bw.Close()
Write-Output "wrote favicon.ico"

$targets = @(
  @{ Path = 'apple-touch-icon.png'; Size = 180 },
  @{ Path = 'assets/icon-192.png'; Size = 192 },
  @{ Path = 'assets/icon-512.png'; Size = 512 }
)
foreach ($t in $targets) {
  $bmp = New-KapitalIcon $t.Size
  $out = Join-Path $root $t.Path
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "wrote $($t.Path)"
}
