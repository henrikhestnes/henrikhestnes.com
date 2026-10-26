# Cloudflare infrastructure as code

Terraform for the parts of the `henrikhestnes.com` account that were set up by hand in the dashboard. The Workers themselves stay with Wrangler:

| Managed here (Terraform) | Managed by Wrangler | Still manual |
|---|---|---|
| Email Routing (enable, DNS records, destination address) | Homepage Worker + custom domains (`../wrangler.jsonc`) | Clicking the destination-address verification link |
| WWW → apex redirect ruleset | Postcards Worker, D1 binding, vars, `send_email` binding (`../postcards-worker/wrangler.jsonc`) | `ADMIN_PASSWORD` secret (`wrangler secret put`) |
| D1 database `henrik-postcards` (existence only; schema via migrations) | D1 migrations (`npm run db:migrate`) | Workers Builds git integration (not in the provider) |

The apex and `www` A/AAAA records are created by the Workers custom domains and are deliberately not declared here.

## One-time setup

1. Create an API token at <https://dash.cloudflare.com/profile/api-tokens> with:
   - Zone → Zone: Read, Zone Settings: Edit, DNS: Edit, Email Routing Rules: Edit, Single Redirect: Edit
   - Account → Email Routing Addresses: Edit, D1: Edit
   - Scoped to this account and the `henrikhestnes.com` zone.
2. Export it: `export CLOUDFLARE_API_TOKEN=...` (never commit it).
3. Find the ids of dashboard-created resources and put them in `terraform.tfvars`:

   ```sh
   cp terraform.tfvars.example terraform.tfvars
   scripts/find-ids.sh
   ```

4. Adopt everything and check for drift. The first plan should show imports and no changes, or only cosmetic ones such as the ruleset name/description:

   ```sh
   terraform init
   terraform plan
   terraform apply
   ```

Until a remote backend is configured, state is written to `terraform.tfstate` in this directory and git-ignored. Do not lose it; it is the only record of what Terraform has adopted. To make it shared and durable, create an R2 bucket, make an R2 API token, and uncomment the `backend "s3"` block in `versions.tf`.

## Day to day

- Change `.tf` files, run `terraform plan`, review, `terraform apply`.
- Changing `notify_email` creates a new destination address and sends a fresh verification mail; update `NOTIFY_TO` in `../postcards-worker/wrangler.jsonc` and redeploy the Worker too.
- `prevent_destroy` on the D1 database means a plan that would replace it fails on purpose. Back up with `wrangler d1 export` first if you really intend that.
- The existing GitHub Actions workflow runs tests only and has no Cloudflare token. Adding `terraform plan` to CI would need a token secret; apply from a laptop until that is wanted.
