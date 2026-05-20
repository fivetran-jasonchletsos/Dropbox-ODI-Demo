output "s3_bucket_name" {
  description = "Name of the MDLS S3 bucket"
  value       = aws_s3_bucket.mdls.bucket
}

output "s3_bucket_arn" {
  description = "ARN of the MDLS S3 bucket"
  value       = aws_s3_bucket.mdls.arn
}

output "glue_database_name" {
  description = "Glue Data Catalog database name"
  value       = aws_glue_catalog_database.mdls.name
}

output "glue_database_arn" {
  description = "Glue Data Catalog database ARN"
  value       = aws_glue_catalog_database.mdls.arn
}

output "fivetran_assume_role_arn" {
  description = "Role ARN that Fivetran MDLS assumes to write Iceberg data"
  value       = aws_iam_role.fivetran_mdls.arn
}

output "snowflake_assume_role_arn" {
  description = "Role ARN that Snowflake EXTERNAL VOLUME assumes to read Iceberg data"
  value       = aws_iam_role.snowflake_mdls_reader.arn
}

# Null until the fivetran provider supports MDLS destinations; see fivetran.tf.
output "fivetran_destination_id" {
  description = "Fivetran destination ID (null until provider supports MDLS)"
  value       = null
}
