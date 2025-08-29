#!/usr/bin/env sh

# Terminal UI
# Colors
RED='\033[0;31m'                                              GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
RESET='\033[0m'

# Usage example for colors:
# echo -e "${RED}This is red text${RESET}"

# Prompt function with colored message and default answer
prompt() {
  local prompt_msg="$1"
  local default_answer="$2"
  local input
  if [ -n "$default_answer" ]; then
    echo -e -n "${CYAN}${prompt_msg} [${default_answer}]: ${RESET}"
    read input
    input="${input:-$default_answer}"
  else
    echo -e -n "${CYAN}${prompt_msg}: ${RESET}"
    read input
  fi
  echo "$input"
}

# Progress bar function
# Usage: progress_bar current total
progress_bar() {
  local progress=$1
  local total=$2
  local width=40
  local filled=$(( progress * width / total ))
  local empty=$(( width - filled ))
  local bar=$(printf '%0.s#' $(seq 1 $filled))$(printf '%0.s-' $(seq 1 $empty))
  printf "\r[${GREEN}%s${RESET}] %d%%" "$bar" $(( progress * 100 / total ))
  if [ $progress -eq $total ]; then
    echo
  fi
}

# Separator line
separator() {
  local char=${1:-"-"}
  local width=60
  printf '%*s\n' "$width" '' | tr ' ' "$char"
}

# Function to print info, warn, error messages with color
info() {
  echo -e "${GREEN}[INFO]${RESET} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${RESET} $1"
}

error() {
  echo -e "${RED}[ERROR]${RESET} $1"
}

# Clear the current line in terminal to refresh output
clear_line() {
  printf "\r%*s\r" "$(tput cols)" ""
}

# Confirmation prompt, returns 0 for yes, 1 for no
confirm() {
  while true; do
    echo -e -n "${CYAN}$1 [y/n]: ${RESET}"
    read yn
    case $yn in
      [Yy]* ) return 0;;
      [Nn]* ) return 1;;
      * ) echo "Please answer yes or no.";;
    esac
  done
}

# Loading spinner for background processes
# Usage: spinner <pid>
spinner() {
  local pid=$1
  local delay=0.1
  local spinstr='|/-\\'
  while kill -0 $pid 2>/dev/null; do
    local temp=${spinstr#?}
    printf " [%c]  " "$spinstr"
    spinstr=$temp${spinstr%$temp}
    sleep $delay
    printf "\b\b\b\b\b\b"
  done
  printf "    \b\b\b\b"
}
