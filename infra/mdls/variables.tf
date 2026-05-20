variable "aws_region" {
  description = "AWS region for the S3 bucket and Glue catalog"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name_prefix" {
  description = "Prefix for the MDLS S3 bucket; a random suffix is appended for global uniqueness"
  type        = string
  default     = "sentinel-mdls"
}

variable "glue_database_name" {
  description = "AWS Glue Data Catalog database that MDLS will register Iceberg tables in"
  type        = string
  default     = "jason_chletsos_sentinel"
}

# Fivetran's AWS account ID used as the trusted principal for the MDLS assume-role.
# Source: https://fivetran.com/docs/destinations/managed-data-lake-service/aws-setup-guide
variable "fivetran_aws_account_id" {
  description = "Fivetran's AWS account ID that assumes the MDLS role"
  type        = string
  default     = "834469178297"
}

variable "fivetran_external_id" {
  description = "External ID shown in the Fivetran MDLS destination setup UI; required for STS AssumeRole"
  type        = string
}

variable "snowflake_aws_account_id" {
  description = "Snowflake's AWS account ID, obtained from DESCRIBE EXTERNAL VOLUME after the volume is first created"
  type        = string
}

variable "snowflake_external_id" {
  description = "External ID from DESCRIBE EXTERNAL VOLUME; placeholder on first apply, real value on second apply"
  type        = string
  default     = "REPLACE_AFTER_FIRST_APPLY"
}

variable "fivetran_api_key" {
  description = "Fivetran API key"
  type        = string
  sensitive   = true
}

variable "fivetran_api_secret" {
  description = "Fivetran API secret"
  type        = string
  sensitive   = true
}

variable "fivetran_destination_name" {
  description = "Name of the Fivetran MDLS destination resource"
  type        = string
  default     = "sentinel_mdls"
}
