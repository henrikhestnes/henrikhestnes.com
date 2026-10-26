# WWW to apex. A zone has exactly one ruleset per phase, so this must be
# imported if the redirect already exists in the dashboard (see imports.tf).

resource "cloudflare_ruleset" "redirects" {
  zone_id = local.zone_id
  # Cloudflare names the one zone-phase ruleset "default"; renaming forces replacement.
  name        = "default"
  description = ""
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules = [
    {
      ref         = "www_to_apex"
      description = "WWW to apex"
      enabled     = true
      expression  = "(http.host eq \"www.${var.zone_name}\")"
      action      = "redirect"
      action_parameters = {
        from_value = {
          status_code           = 301
          preserve_query_string = true
          target_url = {
            expression = "concat(\"https://${var.zone_name}\", http.request.uri.path)"
          }
        }
      }
    }
  ]
}
