output "zone_id" {
  value = local.zone_id
}

output "email_routing_status" {
  description = "Expected: ready. misconfigured means DNS records are missing."
  value       = cloudflare_email_routing_dns.site.status
}

output "notify_address_verified_at" {
  description = "Null until the verification link in the mailbox has been clicked."
  value       = cloudflare_email_routing_address.notify.verified
}

output "postcards_d1_id" {
  value = cloudflare_d1_database.postcards.id
}
