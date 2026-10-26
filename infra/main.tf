data "cloudflare_zone" "site" {
  filter = {
    name = var.zone_name
  }
}

locals {
  zone_id = data.cloudflare_zone.site.id
}
