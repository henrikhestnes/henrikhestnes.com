terraform {
  required_version = ">= 1.7"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }

  # State contains resource identifiers. Keep it out of git.
  # Remote state in a Cloudflare R2 bucket (S3-compatible). Create the bucket
  # once, then set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY to an R2 API token
  # and uncomment. See README.md.
  #
  # backend "s3" {
  #   bucket                      = "henrikhestnes-terraform-state"
  #   key                         = "henrikhestnes.com/terraform.tfstate"
  #   region                      = "auto"
  #   endpoints                   = { s3 = "https://2d9cd71eed7053be2a3685407e9035a5.r2.cloudflarestorage.com" }
  #   skip_credentials_validation = true
  #   skip_region_validation      = true
  #   skip_requesting_account_id  = true
  #   skip_metadata_api_check     = true
  #   skip_s3_checksum            = true
  #   use_path_style              = true
  # }
}

# Authenticates with the CLOUDFLARE_API_TOKEN environment variable.
provider "cloudflare" {}
