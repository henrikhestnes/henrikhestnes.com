variable "account_id" {
  description = "Cloudflare account that owns the zone, Workers and D1."
  type        = string
  default     = "2d9cd71eed7053be2a3685407e9035a5"
}

variable "zone_name" {
  description = "Apex domain of the site."
  type        = string
  default     = "henrikhestnes.com"
}

variable "notify_email" {
  description = "Mailbox that receives new-postcard notifications. Must match NOTIFY_TO in postcards-worker/wrangler.jsonc."
  type        = string
  default     = "henrik.hestnes@hotmail.com"
}

variable "postcards_d1_name" {
  description = "D1 database used by the postcards Worker. Must match wrangler.jsonc."
  type        = string
  default     = "henrik-postcards"
}

# Identifiers of resources that already exist and must be imported rather than
# created. Fill these in terraform.tfvars (see terraform.tfvars.example) by
# running scripts/find-ids.sh.
variable "postcards_d1_id" {
  description = "Existing D1 database id (database_id in postcards-worker/wrangler.jsonc)."
  type        = string
  default     = "4f40f4d0-741c-47a7-b7b6-f7422eee1df7"
}

variable "redirect_ruleset_id" {
  description = "Id of the zone's existing http_request_dynamic_redirect ruleset. Empty if none exists yet."
  type        = string
  default     = ""
}

variable "notify_address_id" {
  description = "Id of the existing Email Routing destination address for notify_email. Empty if not created yet."
  type        = string
  default     = ""
}
