provider "aws" {
  region = var.aws_region
}

locals {
  tags = {
    Project     = "Sentinel-ODI-Demo"
    ManagedBy   = "Terraform"
    Environment = "demo"
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "mdls" {
  bucket = "${var.bucket_name_prefix}-${random_id.bucket_suffix.hex}"
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "mdls" {
  bucket = aws_s3_bucket.mdls.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "mdls" {
  bucket = aws_s3_bucket.mdls.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "mdls" {
  bucket                  = aws_s3_bucket.mdls.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Iceberg snapshot files accumulate quickly; cool storage after a month keeps the demo cheap.
resource "aws_s3_bucket_lifecycle_configuration" "mdls" {
  bucket = aws_s3_bucket.mdls.id

  rule {
    id     = "transition-old-snapshots"
    status = "Enabled"

    filter {}

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
  }
}

resource "aws_glue_catalog_database" "mdls" {
  name        = var.glue_database_name
  description = "MDLS landing zone for the Sentinel ODI demo"

  tags = local.tags
}
