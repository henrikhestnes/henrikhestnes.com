#!/usr/bin/env sh
# Prints the identifiers of dashboard-created resources that imports.tf adopts.
# Requires CLOUDFLARE_API_TOKEN with the permissions listed in README.md.
set -eu
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
ACCOUNT="${ACCOUNT_ID:-2d9cd71eed7053be2a3685407e9035a5}"
ZONE_NAME="${ZONE_NAME:-henrikhestnes.com}"
API=https://api.cloudflare.com/client/v4
H="Authorization: Bearer $CLOUDFLARE_API_TOKEN"

ZONE_ID=$(curl -fsS -H "$H" "$API/zones?name=$ZONE_NAME" | node -pe 'JSON.parse(require("fs").readFileSync(0)).result[0].id')
echo "zone_id             = \"$ZONE_ID\""

curl -fsS -H "$H" "$API/zones/$ZONE_ID/rulesets" | node -e '
const r=JSON.parse(require("fs").readFileSync(0)).result.find(x=>x.phase==="http_request_dynamic_redirect");
console.log(`redirect_ruleset_id = "${r?r.id:""}"`)'

curl -fsS -H "$H" "$API/accounts/$ACCOUNT/email/routing/addresses" | node -e '
for(const a of JSON.parse(require("fs").readFileSync(0)).result)
  console.log(`notify_address_id   = "${a.id}"  # ${a.email} ${a.verified?"verified":"UNVERIFIED"}`)'

curl -fsS -H "$H" "$API/accounts/$ACCOUNT/d1/database" | node -e '
for(const d of JSON.parse(require("fs").readFileSync(0)).result)
  console.log(`# d1 ${d.name}: ${d.uuid}`)'
