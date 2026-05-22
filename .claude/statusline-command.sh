#!/bin/sh
input=$(cat)

# Current working directory
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // empty')

# Context window usage
ctx_used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
ctx_remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# Rate limits
five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
week_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
week_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

out=""

# Rate limit section
rate_out=""
if [ -n "$five_pct" ]; then
  five_pct_fmt=$(printf '%.0f' "$five_pct")
  reset_fmt=""
  if [ -n "$five_reset" ]; then
    reset_fmt=$(date -d "@${five_reset}" "+%H:%M" 2>/dev/null || date -r "${five_reset}" "+%H:%M" 2>/dev/null)
  fi
  if [ -n "$reset_fmt" ]; then
    rate_out="5h limit: ${five_pct_fmt}% used (resets ${reset_fmt})"
  else
    rate_out="5h limit: ${five_pct_fmt}% used"
  fi
fi
if [ -n "$week_pct" ]; then
  week_pct_fmt=$(printf '%.0f' "$week_pct")
  reset_fmt=""
  if [ -n "$week_reset" ]; then
    reset_fmt=$(date -d "@${week_reset}" "+%a %H:%M" 2>/dev/null || date -r "${week_reset}" "+%a %H:%M" 2>/dev/null)
  fi
  if [ -n "$reset_fmt" ]; then
    week_str="7d limit: ${week_pct_fmt}% used (resets ${reset_fmt})"
  else
    week_str="7d limit: ${week_pct_fmt}% used"
  fi
  if [ -n "$rate_out" ]; then
    rate_out="${rate_out} | ${week_str}"
  else
    rate_out="$week_str"
  fi
fi

# Context window section
ctx_out=""
if [ -n "$ctx_used" ]; then
  ctx_used_fmt=$(printf '%.0f' "$ctx_used")
  ctx_out="Context: ${ctx_used_fmt}% used"
elif [ -n "$ctx_remaining" ]; then
  ctx_remaining_fmt=$(printf '%.0f' "$ctx_remaining")
  ctx_out="Context: ${ctx_remaining_fmt}% remaining"
fi

# Directory section
dir_out=""
if [ -n "$cwd" ]; then
  dir_out="Dir: ${cwd}"
fi

# Assemble output
for part in "$rate_out" "$ctx_out" "$dir_out"; do
  if [ -n "$part" ]; then
    if [ -n "$out" ]; then
      out="${out} | ${part}"
    else
      out="$part"
    fi
  fi
done

echo "$out"
