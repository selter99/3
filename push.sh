#!/bin/bash
set -e

# Nếu không truyền commit message thì dùng mặc định
COMMIT_MSG=${1:-"reset project with new code"}

# Lấy URL remote hiện tại (nếu có)
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$REMOTE_URL" ]; then
  echo "⚠️ Repo chưa có remote 'origin'."
  echo "👉 Vui lòng thêm thủ công bằng:"
  echo "   git remote add origin https://github.com/USERNAME/REPO.git"
  exit 1
fi

echo "🔥 Xóa history cũ..."
rm -rf .git
git init

echo "🔗 Kết nối lại remote: $REMOTE_URL"
git remote add origin "$REMOTE_URL"

echo "🚀 Add tất cả file..."
git add .

echo "📝 Commit mới..."
git commit -m "$COMMIT_MSG"

echo "⬆️ Force push lên GitHub..."
git branch -M main
git push -f origin main

echo "✅ Repo đã được reset với code mới!"
