#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-us-east-2}"
STACK="${BLOBNOISE_STACK_NAME:-blobnoise-studio}"
export AWS_PAGER=""

if [[ "$REGION" != "us-east-2" ]]; then
  printf 'This deployment is scoped to us-east-2; received %s.\n' "$REGION" >&2
  exit 1
fi

cd "$ROOT"
npm run build
aws cloudformation validate-template \
  --region "$REGION" --template-body file://infra/studio.json >/dev/null
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file infra/studio.json \
  --no-fail-on-empty-changeset \
  --tags Project=blobnoise ManagedBy=CloudFormation Purpose=PublicStudio

BUCKET="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue | [0]' --output text)"
DISTRIBUTION="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue | [0]' --output text)"
DOMAIN="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`DomainName`].OutputValue | [0]' --output text)"
if [[ -z "$BUCKET" || "$BUCKET" == "None" || -z "$DISTRIBUTION" || "$DISTRIBUTION" == "None" ||
      -z "$DOMAIN" || "$DOMAIN" == "None" ]]; then
  printf 'Deployment stack did not return its required hosting outputs.\n' >&2
  exit 1
fi

# Upload new content-addressed assets before switching the HTML entry point.
# Keep older hashes so open tabs and rollback HTML continue to work.
aws s3 sync apps/studio/dist/assets "s3://$BUCKET/assets" \
  --region "$REGION" --cache-control 'public,max-age=31536000,immutable' --only-show-errors
aws s3 sync apps/studio/dist "s3://$BUCKET" \
  --region "$REGION" --exclude 'assets/*' --exclude 'index.html' \
  --cache-control 'public,max-age=300' --only-show-errors
aws s3 cp apps/studio/dist/index.html "s3://$BUCKET/index.html" \
  --region "$REGION" --content-type 'text/html; charset=utf-8' \
  --cache-control 'no-cache,max-age=0,must-revalidate' --only-show-errors

aws cloudfront wait distribution-deployed --id "$DISTRIBUTION"
INVALIDATION="$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" \
  --paths / /index.html /THIRD-PARTY-LICENSES.md /robots.txt /sitemap.xml /og-image.png /favicon.svg /apple-touch-icon.png /404.html \
  --query 'Invalidation.Id' --output text)"
aws cloudfront wait invalidation-completed \
  --distribution-id "$DISTRIBUTION" --id "$INVALIDATION"

printf '\nStudio: https://%s\nStack: %s (%s)\n' "$DOMAIN" "$STACK" "$REGION"
