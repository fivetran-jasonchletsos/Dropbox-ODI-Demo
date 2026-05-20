provider "fivetran" {
  api_key    = var.fivetran_api_key
  api_secret = var.fivetran_api_secret
}

# The fivetran/fivetran provider (~> 1.1) does not yet expose the MDLS destination
# service type. Until it does, create the destination in the Fivetran UI:
#   Destinations -> Add destination -> Managed Data Lake Service
#   Bucket:    aws_s3_bucket.mdls.bucket  (see outputs)
#   Region:    var.aws_region
#   Catalog:   AWS Glue
#   Database:  var.glue_database_name
#   Role ARN:  aws_iam_role.fivetran_mdls.arn  (see outputs)
#   External ID: var.fivetran_external_id
#
# Once the provider ships MDLS support, uncomment and `terraform import` the
# destination by group ID to bring it under management.
#
# resource "fivetran_destination" "sentinel_mdls" {
#   service    = "managed_data_lake"
#   region     = "GCP_US_EAST4" # placeholder — replace with the Fivetran region enum
#   time_zone_offset = "0"
#   group_id   = "<fivetran group id>"
#
#   config {
#     bucket             = aws_s3_bucket.mdls.bucket
#     region             = var.aws_region
#     role_arn           = aws_iam_role.fivetran_mdls.arn
#     external_id        = var.fivetran_external_id
#     catalog            = "aws_glue"
#     glue_database_name = aws_glue_catalog_database.mdls.name
#   }
# }
