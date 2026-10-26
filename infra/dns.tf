# Plain DNS records that Email Routing does not own.
#
# DMARC tells receivers (Outlook in particular) what to do with mail that fails
# SPF/DKIM alignment. p=none only asks them to evaluate, which is enough to
# improve the sender reputation of postcards@henrikhestnes.com. Tighten to
# p=quarantine once nothing legitimate sends from the domain outside Cloudflare.
resource "cloudflare_dns_record" "dmarc" {
  zone_id = local.zone_id
  name    = "_dmarc.${var.zone_name}"
  type    = "TXT"
  content = "\"v=DMARC1; p=none;\""
  ttl     = 1
  comment = "DMARC for Email Routing notifications. Managed by Terraform."
}
