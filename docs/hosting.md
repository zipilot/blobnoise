# Hosting the studio

**Live:** <https://d16acm1lzz4dn2.cloudfront.net/>

**Source:** <https://github.com/alejo-valencia/blobnoise>

**Stack:** `blobnoise-studio` in `us-east-2`

**CloudFront distribution:** `EBWLI42G70ILW`

The static studio uses an S3 bucket in **us-east-2**, with public HTTPS delivery
through CloudFront. CloudFront is a global service; the origin and
CloudFormation stack are in Ohio. Rendering/export runs on the visitor's
device, not on EC2 or a server-side graphics service.

## Deploy

Use an authorized AWS identity and Node.js 22.12+:

```sh
npm ci
npm run check
bash scripts/deploy-studio.sh
```

The deployment command builds the package/studio, validates and deploys
`infra/studio.json`, uploads static output, and waits for CloudFront deployment
and HTML invalidation. It creates/updates only the `blobnoise-studio` stack.
An alternate stack name may be supplied with `BLOBNOISE_STACK_NAME`; the
script deliberately rejects regions other than us-east-2.

After deployment, exercise actual rendering and downloadable WebP/WebM through
the public website, including its HTTPS and security-header environment:

```sh
npm run smoke:studio -- https://YOUR_CLOUDFRONT_HOST
```

The smoke command uses the existing Playwright installation. It creates
small local browser exports; it does not upload user designs.

The initial public release on 2026-09-10 completed this smoke flow, including
a decoded one-second WebM and a WebP download through the site's actual
security headers. Direct anonymous S3 access returned 403; CloudFront returned
the public site over HTTPS.

Find the actual URL and resource identifiers:

```sh
aws cloudformation describe-stacks \
  --region us-east-2 --stack-name blobnoise-studio \
  --query 'Stacks[0].Outputs'
```

No AWS credentials belong in Git. This repository does not configure a
GitHub-to-AWS role or automatic deployment workflow.

## Delivery and costs

The site is public. The S3 bucket is not: CloudFront Origin Access Control is
granted read-only access to this bucket for this distribution. All S3 public
access controls remain enabled. HTTPS is required; a CloudFront-provided
hostname/certificate avoids a domain registration or ACM setup.

HTML is revalidated, hashed assets are cached immutably, and older asset
hashes are retained so open tabs survive a deployment. Third-party license
text ships alongside the site. Security headers allow local canvas, Blob
downloads and media workers without third-party scripts or framing.

The site also serves an indexable HTML description, sitemap, robots file,
favicon and original social preview image. Missing S3 objects return a real
404 through CloudFront instead of a 200 application shell; the error document
is marked `noindex`. See [search metadata](seo.md).

This is usage-billed S3/CloudFront hosting, not a promise of free hosting.
There is no additional EC2 instance, load balancer, NAT gateway, database,
Lambda or paid domain. CloudFront uses PriceClass_100. Storage, transfer,
requests and invalidations can still incur AWS charges as usage grows.
There is no application telemetry or saved user-design backend.

## Rollback and teardown

Redeploy a previously accepted source revision using the same script.
The bucket is versioned; noncurrent object versions are retained for 30 days.
Current hashed assets are not automatically deleted.

The bucket has a retain policy so deleting/replacing the stack does not
silently erase assets. Full teardown requires deliberate deletion of the
distribution/stack and a separately authorized cleanup of the retained,
versioned bucket. Do not run broad account cleanup commands.

## Testing the EC2 development server without Tailscale

Deployment is not required for a private development preview. If your
computer has SSH access to the EC2 instance, start the studio on EC2:

```sh
cd /home/ubuntu/blobnoise
npm run dev
```

Then, from your computer, use your existing SSH host/key configuration:

```sh
ssh -N -L 5173:127.0.0.1:5173 ubuntu@YOUR_EC2_HOST
```

Open `http://localhost:5173` on your computer. This forwards the loopback-only
Vite server through SSH; it does not require making port 5173 public.
If EC2 has no direct SSH route, an already-configured AWS Systems Manager
port-forwarding session is another option; this deployment does not provision
SSM access or change the EC2 instance's security groups.
