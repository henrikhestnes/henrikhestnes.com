# Adopt resources that already exist. Terraform 1.7+ evaluates these on the
# first plan/apply and records them in state; remove a block once it has been
# applied, or leave it, since an already-imported id is a no-op.

import {
  to = cloudflare_email_routing_settings.site
  id = local.zone_id
}

import {
  to = cloudflare_email_routing_dns.site
  id = local.zone_id
}

import {
  to = cloudflare_d1_database.postcards
  id = "${var.account_id}/${var.postcards_d1_id}"
}

import {
  for_each = var.redirect_ruleset_id == "" ? {} : { ruleset = var.redirect_ruleset_id }
  to       = cloudflare_ruleset.redirects
  id       = "zones/${local.zone_id}/${each.value}"
}

import {
  for_each = var.notify_address_id == "" ? {} : { address = var.notify_address_id }
  to       = cloudflare_email_routing_address.notify
  id       = "${var.account_id}/${each.value}"
}
