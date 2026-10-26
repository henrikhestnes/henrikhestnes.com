# The guestbook database. Terraform owns its existence only; schema lives in
# postcards-worker/migrations and is applied with `npm run db:migrate`.
# Replacing this resource deletes every postcard, hence prevent_destroy.

resource "cloudflare_d1_database" "postcards" {
  account_id = var.account_id
  name       = var.postcards_d1_name

  read_replication = {
    mode = "disabled"
  }

  lifecycle {
    prevent_destroy = true
  }
}
