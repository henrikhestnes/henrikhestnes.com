# Email Routing is what lets the postcards Worker send from
# postcards@henrikhestnes.com through its send_email binding.
#
# The MX, SPF and DKIM records are created and locked by Cloudflare through
# cloudflare_email_routing_dns. Do not also declare them as cloudflare_dns_record;
# the two would fight over the same records.

resource "cloudflare_email_routing_settings" "site" {
  zone_id            = local.zone_id
  support_subaddress = false
}

resource "cloudflare_email_routing_dns" "site" {
  # Do not set `name`: the provider sends it as a PATCH that Cloudflare only
  # accepts for subdomain routing and answers 404 "Subdomain not found".
  zone_id = local.zone_id

  depends_on = [cloudflare_email_routing_settings.site]
}

# Destination addresses are account-level. Cloudflare emails a verification
# link to the address when it is created; sending is refused until it is clicked.
resource "cloudflare_email_routing_address" "notify" {
  account_id = var.account_id
  email      = var.notify_email
}
